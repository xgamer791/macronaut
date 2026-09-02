import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb } from '@/db/__tests__/testDb';
import { SYNC_TABLES, allColumns } from '../tables';

/**
 * The engine reads its column list from SYNC_TABLES and sends exactly those
 * names to Postgres. Three places therefore have to agree: the local SQLite
 * schema, the declaration in tables.ts, and the Supabase migration.
 *
 * A mismatch is unusually nasty. It does not fail the build or any other test;
 * it breaks one table at runtime, for real users, with a message nobody sees
 * unless they open Settings. So the three are checked against each other here.
 */
const MIGRATION = readFileSync(
  join(__dirname, '../../../../supabase/migrations/0002_sync_tables.sql'),
  'utf8',
);

/** The `create table public.<name> ( ... );` body for one table. */
function remoteTableBody(name: string): string {
  const start = MIGRATION.indexOf(`create table if not exists public.${name} (`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = MIGRATION.indexOf('\n);', start);
  expect(end).toBeGreaterThan(start);
  return MIGRATION.slice(start, end);
}

describe('sync schema agreement', () => {
  it.each(SYNC_TABLES.map((t) => [t.name, t] as const))(
    '%s has the same columns locally and in Supabase',
    async (_name, table) => {
      const db = await createTestDb();
      const local = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table.name})`);
      const localNames = new Set(local.map((c) => c.name));
      const body = remoteTableBody(table.name);

      for (const column of allColumns(table)) {
        // Declared columns must exist locally, or every push of this table
        // fails with "no such column".
        expect(localNames.has(column)).toBe(true);
        // ...and remotely, or the upsert is rejected by PostgREST.
        expect(body).toContain(`"${column}"`);
      }
    },
  );

  it('declares every local column, so nothing silently stays on the device', async () => {
    const db = await createTestDb();
    for (const table of SYNC_TABLES) {
      const local = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table.name})`);
      const declared = new Set(allColumns(table));
      const missing = local.map((c) => c.name).filter((c) => !declared.has(c));
      expect({ table: table.name, missing }).toEqual({ table: table.name, missing: [] });
    }
  });

  it('gives every synced table the RLS and trigger boilerplate', () => {
    // The migration applies these in a loop over a hand-written array. A table
    // added to SYNC_TABLES but forgotten there would be created with no policy
    // at all — readable by every signed-in user of the project.
    const list = MIGRATION.slice(
      MIGRATION.indexOf('tables text[] := array['),
      MIGRATION.indexOf('];', MIGRATION.indexOf('tables text[] := array[')),
    );
    for (const table of SYNC_TABLES) {
      expect(list).toContain(`'${table.name}'`);
    }
  });

  it('keeps user_id out of the synced columns', () => {
    // Ownership is set by the server. If it were also a declared column the
    // engine would push whatever the local row happened to hold.
    for (const table of SYNC_TABLES) {
      expect(allColumns(table)).not.toContain('user_id');
    }
  });

  it('does not sync the shared food cache', () => {
    // cached_foods is identical for every user and refillable from the network.
    expect(SYNC_TABLES.map((t) => t.name)).not.toContain('cached_foods');
  });
});
