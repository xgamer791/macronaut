import { Platform } from 'react-native';
import { Database } from './driver';
import { migrate } from './migrations';
import { LEGACY_SCOPE, dbFileNameForScope, idbKeyForScope } from './scope';

const instances = new Map<string, Promise<Database>>();

/** Per-account database singleton: opens the platform driver for `scope` and
 * applies any pending migrations exactly once. Each scope is a separate
 * SQLite database, so two accounts on one device never share rows. */
export function getDatabase(scope: string = LEGACY_SCOPE): Promise<Database> {
  const existing = instances.get(scope);
  if (existing) return existing;

  const opening = (async () => {
    const db =
      Platform.OS === 'web'
        ? await (await import('./webDriver')).createWebDriver(idbKeyForScope(scope))
        : await (await import('./expoDriver')).createExpoDriver(dbFileNameForScope(scope));
    await migrate(db);
    return db;
  })();

  instances.set(scope, opening);
  // A failed open must not be cached, or every later attempt replays the error.
  opening.catch(() => instances.delete(scope));
  return opening;
}

/** Test seam — replace or clear a cached instance. */
export function setDatabaseForTesting(
  db: Promise<Database> | null,
  scope: string = LEGACY_SCOPE,
): void {
  if (db) instances.set(scope, db);
  else instances.delete(scope);
}
