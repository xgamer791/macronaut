import { Database, SqlParams } from '@/db/driver';
import { CURSOR, DELETED, RemoteStore, Row } from './remote';
import { PK_SEPARATOR, SYNC_TABLES, SyncTable, allColumns, rowKey } from './tables';

/** Rows per network round trip. Large enough that a typical sync is one
 * request per table, small enough to stay well inside request size limits. */
const BATCH = 200;

/** Guards against a malformed cursor looping forever on a server that keeps
 * returning the same page. */
const MAX_PAGES = 200;

export interface SyncResult {
  pushed: number;
  pulled: number;
}

interface OutboxEntry {
  table_name: string;
  row_key: string;
  op: 'upsert' | 'delete';
  rev: number;
}

/**
 * One full reconciliation: send local changes, then take remote ones.
 *
 * Push runs first so that a row edited on this device wins over the copy the
 * server had; pull then skips anything still sitting in the outbox, which is
 * work queued after the push snapshot and therefore newer still. The net
 * effect is last-write-wins at row granularity, biased toward the device the
 * user is actually holding.
 *
 * Safe to call repeatedly. It is not safe to run two at once against the same
 * database — `startSync` serialises callers.
 */
export async function syncOnce(db: Database, remote: RemoteStore): Promise<SyncResult> {
  const pushed = await push(db, remote);
  const pulled = await pull(db, remote);
  return { pushed, pulled };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function push(db: Database, remote: RemoteStore): Promise<number> {
  const entries = await db.getAllAsync<OutboxEntry>(
    'SELECT table_name, row_key, op, rev FROM sync_outbox ORDER BY rev',
  );
  if (entries.length === 0) return 0;

  let pushed = 0;
  for (const table of SYNC_TABLES) {
    const mine = entries.filter((e) => e.table_name === table.name);
    if (mine.length === 0) continue;

    for (let i = 0; i < mine.length; i += BATCH) {
      pushed += await pushBatch(db, remote, table, mine.slice(i, i + BATCH));
    }
  }
  return pushed;
}

async function pushBatch(
  db: Database,
  remote: RemoteStore,
  table: SyncTable,
  queued: OutboxEntry[],
): Promise<number> {
  // The triggers already refuse to queue these, so reaching here means the row
  // was queued by an older build or by something writing to the outbox
  // directly. One of them is the user's API key, so it is checked again at the
  // last point before the network rather than trusted to the schema alone.
  const blocked = queued.filter((e) => table.excludeKeys?.includes(e.row_key));
  const batch = queued.filter((e) => !table.excludeKeys?.includes(e.row_key));
  if (blocked.length > 0) await clearSent(db, blocked);
  if (batch.length === 0) return blocked.length;

  const removals = batch.filter((e) => e.op === 'delete');
  const upserts = batch.filter((e) => e.op === 'upsert');

  if (removals.length > 0) {
    await remote.remove(
      table,
      removals.map((e) => keyToRow(table, e.row_key)),
    );
  }

  if (upserts.length > 0) {
    const keys = upserts.map((e) => keyToRow(table, e.row_key));
    const { sql, params } = selectByKeys(table, keys);
    const rows = await db.getAllAsync<Row>(sql, params);
    // A row can vanish between queueing and sending. If it was deleted, the
    // delete trigger has already replaced this entry with a tombstone, so
    // dropping it here loses nothing.
    if (rows.length > 0) await remote.upsert(table, rows.map(stripLocalOnly));
  }

  await clearSent(db, batch);
  return batch.length + blocked.length;
}

/** Removes the outbox entries we just sent, but only those still at the
 * revision we read. A row edited again mid-flight has been bumped to a higher
 * revision and survives, to be pushed on the next pass instead of being
 * silently dropped. */
async function clearSent(db: Database, batch: OutboxEntry[]): Promise<void> {
  await db.withTransaction(async () => {
    for (const entry of batch) {
      await db.runAsync(
        'DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ? AND rev = ?',
        [entry.table_name, entry.row_key, entry.rev],
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function pull(db: Database, remote: RemoteStore): Promise<number> {
  let pulled = 0;
  for (const table of SYNC_TABLES) {
    let cursor = await getState(db, cursorKey(table));

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await remote.pull(table, cursor, BATCH);
      if (result.rows.length === 0) break;

      await applyRemote(db, table, result.rows);
      pulled += result.rows.length;

      if (result.cursor && result.cursor !== cursor) {
        cursor = result.cursor;
        await setState(db, cursorKey(table), cursor);
      } else {
        // No forward progress; stop rather than request the same page again.
        break;
      }
      if (result.rows.length < BATCH) break;
    }
  }
  return pulled;
}

async function applyRemote(db: Database, table: SyncTable, rows: Row[]): Promise<void> {
  // Anything already queued locally is a change the server has not seen yet,
  // so it outranks what we are about to apply.
  const pendingRows = await db.getAllAsync<{ row_key: string }>(
    'SELECT row_key FROM sync_outbox WHERE table_name = ?',
    [table.name],
  );
  const pending = new Set(pendingRows.map((r) => r.row_key));

  await db.withTransaction(async () => {
    for (const row of rows) {
      const key = rowKey(table, row);
      if (pending.has(key)) continue;
      // Never let the server dictate a device-only row: a stale API key left
      // in an account by an older build must not overwrite the real one here.
      if (table.excludeKeys?.includes(key)) continue;

      if (row[DELETED] === true) {
        const { sql, params } = deleteByKey(table, row);
        await db.runAsync(sql, params);
      } else {
        const { sql, params } = replaceRow(table, row);
        await db.runAsync(sql, params);
      }

      // Applying a remote row fires the local triggers, which would queue it
      // straight back for upload. Drop that echo.
      await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?', [
        table.name,
        key,
      ]);
    }
  });
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function keyToRow(table: SyncTable, key: string): Row {
  const parts = key.split(PK_SEPARATOR);
  const row: Row = {};
  table.pk.forEach((col, i) => {
    row[col] = parts[i] ?? '';
  });
  return row;
}

/** Drops the bookkeeping columns a pulled row carries, so a row that round
 * trips through the local database is not pushed back with server fields. */
function stripLocalOnly(row: Row): Row {
  const copy = { ...row };
  delete copy[DELETED];
  delete copy[CURSOR];
  delete copy.user_id;
  return copy;
}

function selectByKeys(table: SyncTable, keys: Row[]): { sql: string; params: SqlParams } {
  const cols = allColumns(table)
    .map((c) => `"${c}"`)
    .join(', ');

  if (table.pk.length === 1) {
    const col = table.pk[0];
    const placeholders = keys.map(() => '?').join(', ');
    return {
      sql: `SELECT ${cols} FROM ${table.name} WHERE "${col}" IN (${placeholders})`,
      params: keys.map((k) => String(k[col])),
    };
  }

  const clause = table.pk.map((c) => `"${c}" = ?`).join(' AND ');
  const params: SqlParams = [];
  for (const key of keys) for (const col of table.pk) params.push(String(key[col]));
  return {
    sql: `SELECT ${cols} FROM ${table.name} WHERE ${keys.map(() => `(${clause})`).join(' OR ')}`,
    params,
  };
}

function deleteByKey(table: SyncTable, row: Row): { sql: string; params: SqlParams } {
  const clause = table.pk.map((c) => `"${c}" = ?`).join(' AND ');
  return {
    sql: `DELETE FROM ${table.name} WHERE ${clause}`,
    params: table.pk.map((c) => toSql(row[c])),
  };
}

function replaceRow(table: SyncTable, row: Row): { sql: string; params: SqlParams } {
  const cols = allColumns(table);
  return {
    sql: `INSERT OR REPLACE INTO ${table.name} (${cols.map((c) => `"${c}"`).join(', ')})
          VALUES (${cols.map(() => '?').join(', ')})`,
    params: cols.map((c) => toSql(row[c])),
  };
}

/** SQLite takes strings, numbers and null. Postgres hands back booleans for
 * the columns the local schema stores as 0/1 integers. */
function toSql(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// sync_state
// ---------------------------------------------------------------------------

function cursorKey(table: SyncTable): string {
  return `cursor:${table.name}`;
}

export async function getState(db: Database, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setState(db: Database, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

/** Number of local changes waiting to upload; drives the "Syncing…" hint. */
export async function pendingCount(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
  return row?.n ?? 0;
}
