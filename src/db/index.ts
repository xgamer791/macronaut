import { Platform } from 'react-native';
import { Database } from './driver';
import { migrate } from './migrations';

let instance: Promise<Database> | null = null;

/** App-wide database singleton: opens the platform driver and applies any
 * pending migrations exactly once. */
export function getDatabase(): Promise<Database> {
  if (!instance) {
    instance = (async () => {
      const db =
        Platform.OS === 'web'
          ? await (await import('./webDriver')).createWebDriver()
          : await (await import('./expoDriver')).createExpoDriver();
      await migrate(db);
      return db;
    })();
  }
  return instance;
}

/** Test seam — replace or clear the singleton. */
export function setDatabaseForTesting(db: Promise<Database> | null): void {
  instance = db;
}
