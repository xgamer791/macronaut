import { Database } from '../driver';
import { SYNC_TABLES, SyncTable } from '@/services/sync/tables';

/**
 * Change tracking for cloud sync.
 *
 * The app has ~40 repository methods that write to the diary. Rather than
 * teach every one of them to also talk to Supabase — which would mean touching
 * all of them, and would silently miss any future write that forgot — the
 * database itself records what changed. A trigger on each account-owned table
 * drops a row into `sync_outbox`, and the sync engine drains it later. Writes
 * stay local-speed and offline-safe; the network is somebody else's problem.
 *
 * The outbox is keyed by (table, row), not append-only, so editing one diary
 * entry fifty times before the next sync still pushes it once.
 */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      table_name TEXT NOT NULL,
      row_key TEXT NOT NULL,
      op TEXT NOT NULL CHECK (op IN ('upsert','delete')),
      queued_at TEXT NOT NULL,
      rev INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_key)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  for (const table of SYNC_TABLES) {
    await db.execAsync(triggerSql(table));
  }

  // Everything already on this device predates the outbox, so nothing would
  // ever push it. Seed one upsert per existing row: the first sync after an
  // upgrade uploads the diary the user already has instead of starting empty.
  for (const table of SYNC_TABLES) {
    await db.runAsync(
      `INSERT INTO sync_outbox (table_name, row_key, op, queued_at, rev)
       SELECT '${table.name}', ${keyExpr(table, '')}, 'upsert', ${NOW}, ${NEXT_REV}
       FROM ${table.name}
       WHERE true
       ON CONFLICT (table_name, row_key) DO NOTHING`,
    );
  }
}

/** SQLite has no ISO-8601 `now()`; this is the closest equivalent. It is
 * recorded for debugging only — `rev` is what the engine reasons about. */
const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/** A strictly increasing stamp for each enqueue.
 *
 * The engine uses this to tell "the change I just uploaded" from "a change
 * made while that upload was in flight", and clears only the former. A clock
 * cannot do that job: two writes to the same row inside one millisecond share
 * a timestamp, and the second would be cleared as though it had been sent,
 * losing the edit. A counter has no such tie. */
const NEXT_REV = `(SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox)`;

/** Builds the row's outbox key from a trigger alias (NEW/OLD), or from the
 * bare column when seeding with a plain SELECT. Composite keys join with the
 * same U+0001 separator the engine uses. */
function keyExpr(table: SyncTable, alias: 'NEW' | 'OLD' | ''): string {
  const prefix = alias ? `${alias}.` : '';
  const parts = table.pk.map((col) => `CAST(${prefix}"${col}" AS TEXT)`);
  return parts.length === 1 ? parts[0] : parts.join(` || char(1) || `);
}

function enqueue(table: SyncTable, alias: 'NEW' | 'OLD', op: 'upsert' | 'delete'): string {
  return `
      INSERT INTO sync_outbox (table_name, row_key, op, queued_at, rev)
      VALUES ('${table.name}', ${keyExpr(table, alias)}, '${op}', ${NOW}, ${NEXT_REV})
      ON CONFLICT (table_name, row_key)
      DO UPDATE SET op = '${op}', queued_at = excluded.queued_at, rev = ${NEXT_REV};`;
}

function triggerSql(table: SyncTable): string {
  const n = table.name;
  return `
    DROP TRIGGER IF EXISTS sync_${n}_ai;
    DROP TRIGGER IF EXISTS sync_${n}_au;
    DROP TRIGGER IF EXISTS sync_${n}_ad;

    CREATE TRIGGER sync_${n}_ai AFTER INSERT ON ${n} BEGIN${enqueue(table, 'NEW', 'upsert')}
    END;

    CREATE TRIGGER sync_${n}_au AFTER UPDATE ON ${n} BEGIN${enqueue(table, 'NEW', 'upsert')}
    END;

    CREATE TRIGGER sync_${n}_ad AFTER DELETE ON ${n} BEGIN${enqueue(table, 'OLD', 'delete')}
    END;
  `;
}
