import type { Database as BetterSqlite3Db } from 'better-sqlite3';
import { Database, SqlParams } from './driver';

/** better-sqlite3-backed driver for Jest / Node. Synchronous under the hood,
 * wrapped in resolved promises so it satisfies the async interface. */
export function createNodeDriver(db: BetterSqlite3Db): Database {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params: SqlParams = []) {
      const info = db.prepare(sql).run(...params);
      return { changes: info.changes };
    },
    async getAllAsync<T>(sql: string, params: SqlParams = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParams = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransaction<T>(fn: () => Promise<T>) {
      // better-sqlite3's transaction() can't wrap async fns; manage manually.
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
