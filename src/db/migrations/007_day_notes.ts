import { Database } from '../driver';

/** Per-day journal notes shown on the calendar and day-info popup. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS day_notes (
      date TEXT PRIMARY KEY NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
