import type { Database as SqlJsDatabase } from 'sql.js';
import { Database, SqlParams } from './driver';

/** sql.js (SQLite-in-wasm) driver for the web build, persisted to IndexedDB.
 * GitHub Pages can't serve the COOP/COEP headers OPFS-based drivers need, so
 * the database lives in memory and its serialized bytes are saved to
 * IndexedDB after each write (debounced). */

const IDB_NAME = 'macronaut';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'main';
const SAVE_DEBOUNCE_MS = 250;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteWebDatabase(): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createWebDriver(): Promise<Database> {
  // Dynamic import keeps sql.js out of native bundles.
  const initSqlJs = (await import('sql.js')).default;
  // Metro bundles the wasm as an asset (see metro.config.js) so the file is
  // served same-origin — no external CDN dependency.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wasmAsset = require('sql.js/dist/sql-wasm.wasm');
  const wasmUri: string = typeof wasmAsset === 'string' ? wasmAsset : wasmAsset.uri ?? wasmAsset;
  const SQL = await initSqlJs({ locateFile: () => wasmUri });

  const existing = await idbLoad().catch(() => null);
  const db: SqlJsDatabase = existing ? new SQL.Database(existing) : new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      idbSave(db.export()).catch((err) => {
        console.warn('Failed to persist database', err);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function bind(params: SqlParams): (string | number | null)[] {
    return params;
  }

  return {
    async execAsync(sql) {
      db.exec(sql);
      scheduleSave();
    },
    async runAsync(sql, params: SqlParams = []) {
      db.run(sql, bind(params));
      const changes = db.getRowsModified();
      scheduleSave();
      return { changes };
    },
    async getAllAsync<T>(sql: string, params: SqlParams = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(bind(params));
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async getFirstAsync<T>(sql: string, params: SqlParams = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(bind(params));
        return stmt.step() ? (stmt.getAsObject() as T) : null;
      } finally {
        stmt.free();
      }
    },
    async withTransaction<T>(fn: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        scheduleSave();
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

/** Flush any pending debounced save — used before reset/reload flows. */
export async function flushWebSaves(): Promise<void> {
  await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_MS + 50));
}
