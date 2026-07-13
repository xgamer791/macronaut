import * as SQLite from 'expo-sqlite';
import { Database, SqlParams } from './driver';

/** expo-sqlite driver for iOS/Android. */
export async function createExpoDriver(dbName = 'macronaut.db'): Promise<Database> {
  const db = await SQLite.openDatabaseAsync(dbName);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  return {
    async execAsync(sql) {
      await db.execAsync(sql);
    },
    async runAsync(sql, params: SqlParams = []) {
      const res = await db.runAsync(sql, params);
      return { changes: res.changes };
    },
    async getAllAsync<T>(sql: string, params: SqlParams = []) {
      return db.getAllAsync<T>(sql, params);
    },
    async getFirstAsync<T>(sql: string, params: SqlParams = []) {
      return db.getFirstAsync<T>(sql, params);
    },
    async withTransaction<T>(fn: () => Promise<T>) {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
  };
}
