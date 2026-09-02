import { Database } from '../driver';
import { DEVICE_ONLY_SETTINGS, syncTable } from '@/services/sync/tables';
import { triggerGuard } from './009_sync_outbox';

/**
 * Stop the user's xAI API key from syncing.
 *
 * Migration 009 put a trigger on `settings` that queued every row for upload,
 * including `grokApiKey` — the user's own billable credential, which the AI
 * screens and the privacy policy both promise stays on their device.
 *
 * Databases created after 009 was fixed already have the guarded triggers and
 * an outbox that never held the key, so this is a no-op for them. Databases
 * that ran the original 009 need both halves: the guard, and the removal of
 * anything it already queued.
 */
export async function up(db: Database): Promise<void> {
  const table = syncTable('settings');

  await db.execAsync(`
    DROP TRIGGER IF EXISTS sync_settings_ai;
    DROP TRIGGER IF EXISTS sync_settings_au;
    DROP TRIGGER IF EXISTS sync_settings_ad;

    CREATE TRIGGER sync_settings_ai AFTER INSERT ON settings${triggerGuard(table, 'NEW')}
    BEGIN
      INSERT INTO sync_outbox (table_name, row_key, op, queued_at, rev)
      VALUES ('settings', NEW."key", 'upsert',
              strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox))
      ON CONFLICT (table_name, row_key)
      DO UPDATE SET op = 'upsert', queued_at = excluded.queued_at,
                    rev = (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox);
    END;

    CREATE TRIGGER sync_settings_au AFTER UPDATE ON settings${triggerGuard(table, 'NEW')}
    BEGIN
      INSERT INTO sync_outbox (table_name, row_key, op, queued_at, rev)
      VALUES ('settings', NEW."key", 'upsert',
              strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox))
      ON CONFLICT (table_name, row_key)
      DO UPDATE SET op = 'upsert', queued_at = excluded.queued_at,
                    rev = (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox);
    END;

    CREATE TRIGGER sync_settings_ad AFTER DELETE ON settings${triggerGuard(table, 'OLD')}
    BEGIN
      INSERT INTO sync_outbox (table_name, row_key, op, queued_at, rev)
      VALUES ('settings', OLD."key", 'delete',
              strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox))
      ON CONFLICT (table_name, row_key)
      DO UPDATE SET op = 'delete', queued_at = excluded.queued_at,
                    rev = (SELECT COALESCE(MAX(rev), 0) + 1 FROM sync_outbox);
    END;
  `);

  for (const key of DEVICE_ONLY_SETTINGS) {
    await db.runAsync(`DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_key = ?`, [
      key,
    ]);
  }
}
