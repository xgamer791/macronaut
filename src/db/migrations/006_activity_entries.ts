import { Database } from '../driver';

/** Manual (and future Apple Watch / HealthKit) workout logs. Calories burned
 * are a real column so day/week charts can sum them without parsing JSON. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS activity_entries (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      duration_min REAL,
      distance_km REAL,
      calories_burned REAL NOT NULL,
      intensity TEXT,
      notes TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_entries(date);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_entries(activity_type);
  `);
}
