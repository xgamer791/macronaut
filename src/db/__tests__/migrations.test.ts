import BetterSqlite3 from 'better-sqlite3';
import { createNodeDriver } from '../nodeDriver';
import { Migration, migrate, migrations } from '../migrations';

function freshDb() {
  const raw = new BetterSqlite3(':memory:');
  raw.pragma('foreign_keys = ON');
  return createNodeDriver(raw);
}

describe('migration runner', () => {
  it('applies the full chain on a fresh database', async () => {
    const db = freshDb();
    const applied = await migrate(db);
    expect(applied).toBe(migrations.length);
    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    for (const required of [
      'settings',
      'goal_configs',
      'day_type_marks',
      'meal_categories',
      'custom_foods',
      'cached_foods',
      'diary_entries',
      'saved_meals',
      'saved_meal_items',
      'recipes',
      'recipe_ingredients',
      'food_log_history',
      'search_history',
      'favorites',
      'migrations',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('is idempotent — reruns apply nothing', async () => {
    const db = freshDb();
    await migrate(db);
    expect(await migrate(db)).toBe(0);
  });

  it('seeds the six default meal categories', async () => {
    const db = freshDb();
    await migrate(db);
    const cats = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM meal_categories ORDER BY position',
    );
    expect(cats.map((c) => c.id)).toEqual([
      'breakfast',
      'morning-snack',
      'lunch',
      'afternoon-snack',
      'dinner',
      'evening-snack',
    ]);
  });

  it('a future migration preserves existing user data', async () => {
    const db = freshDb();
    await migrate(db);
    await db.runAsync(
      `INSERT INTO diary_entries (id, date, meal, name, source_type, quantity, unit, nutrition, created_at, updated_at)
       VALUES ('e1', '2026-07-13', 'lunch', 'Test food', 'manual', 1, 'serving', '{"calories":300}', 'now', 'now')`,
    );

    const future: Migration = {
      version: migrations.length + 1,
      name: 'add_column_example',
      up: async (d) => {
        await d.execAsync('ALTER TABLE diary_entries ADD COLUMN example_col TEXT');
      },
    };
    const applied = await migrate(db, [...migrations, future]);
    expect(applied).toBe(1);

    const row = await db.getFirstAsync<{ name: string; example_col: string | null }>(
      'SELECT name, example_col FROM diary_entries WHERE id = ?',
      ['e1'],
    );
    expect(row?.name).toBe('Test food');
    expect(row?.example_col).toBeNull();
  });

  it('rolls back a failing migration atomically', async () => {
    const db = freshDb();
    await migrate(db);
    const bad: Migration = {
      version: migrations.length + 1,
      name: 'bad',
      up: async (d) => {
        await d.execAsync('CREATE TABLE half_done (id TEXT)');
        throw new Error('boom');
      },
    };
    await expect(migrate(db, [...migrations, bad])).rejects.toThrow('boom');
    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'half_done'`,
    );
    expect(tables).toHaveLength(0);
    // Version was not recorded → retried next time.
    const rec = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM migrations WHERE version = ?',
      [bad.version],
    );
    expect(rec).toBeNull();
  });
});
