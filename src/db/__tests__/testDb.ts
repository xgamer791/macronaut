import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../driver';
import { createNodeDriver } from '../nodeDriver';
import { migrate } from '../migrations';

/** Fresh in-memory database with the full migration chain applied. */
export async function createTestDb(): Promise<Database> {
  const raw = new BetterSqlite3(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = createNodeDriver(raw);
  await migrate(db);
  return db;
}
