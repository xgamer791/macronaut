import { Database } from '../driver';
import * as m001 from './001_init';
import * as m002 from './002_food_images';
import * as m003 from './003_food_confidence';
import * as m004 from './004_food_engine';
import * as m005 from './005_meal_categories_four';
import * as m006 from './006_activity_entries';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
}

/** Forward-only, ordered. Add new migrations to the END — never edit an
 * applied one; existing installs replay only what they're missing. */
export const migrations: Migration[] = [
  { version: 1, name: 'init', up: m001.up },
  { version: 2, name: 'food_images', up: m002.up },
  { version: 3, name: 'food_confidence', up: m003.up },
  { version: 4, name: 'food_engine', up: m004.up },
  { version: 5, name: 'meal_categories_four', up: m005.up },
  { version: 6, name: 'activity_entries', up: m006.up },
];

export async function migrate(db: Database, list: Migration[] = migrations): Promise<number> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );`,
  );
  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM migrations ORDER BY version',
  );
  const appliedSet = new Set(applied.map((r) => r.version));
  let count = 0;
  for (const m of [...list].sort((a, b) => a.version - b.version)) {
    if (appliedSet.has(m.version)) continue;
    await db.withTransaction(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        m.version,
        m.name,
        new Date().toISOString(),
      ]);
    });
    count++;
  }
  return count;
}
