import { Database } from '../driver';
import { newId } from '@/repositories/util';

/** Upgrade day_notes from one row per day to many notes per day. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE day_notes_entries (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_day_notes_entries_date ON day_notes_entries(date);
  `);

  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(day_notes)`);
  const legacy = cols.some((c) => c.name === 'date') && !cols.some((c) => c.name === 'id');

  if (legacy) {
    const rows = await db.getAllAsync<{ date: string; body: string; updated_at: string }>(
      'SELECT date, body, updated_at FROM day_notes',
    );
    for (const row of rows) {
      const body = row.body.trim();
      if (!body) continue;
      await db.runAsync(
        `INSERT INTO day_notes_entries (id, date, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newId(), row.date, body, row.updated_at, row.updated_at],
      );
    }
  }

  await db.execAsync(`
    DROP TABLE IF EXISTS day_notes;
    ALTER TABLE day_notes_entries RENAME TO day_notes;
  `);
}
