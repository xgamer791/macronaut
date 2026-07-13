/** Thin async database interface. Repositories depend ONLY on this, so the
 * same code runs against expo-sqlite (native), sql.js (web) and
 * better-sqlite3 (Jest). */
export interface Database {
  /** Run DDL / multiple statements. */
  execAsync(sql: string): Promise<void>;
  /** Run a single parameterized statement (INSERT/UPDATE/DELETE). */
  runAsync(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  /** All rows for a parameterized query. */
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  /** First row or null. */
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  /** Run `fn` inside a transaction; rolls back if it throws. */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export type SqlParams = (string | number | null)[];
