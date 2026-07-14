import { Database } from '../driver';

/** Expand cached_foods for the production food engine: restaurant, preparation,
 * ingredients/allergens, verification metadata, category, and source label.
 * saturated_fat lives inside nutrition JSON — no dedicated column. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    ALTER TABLE cached_foods ADD COLUMN restaurant TEXT;
    ALTER TABLE cached_foods ADD COLUMN preparation_state TEXT;
    ALTER TABLE cached_foods ADD COLUMN ingredients TEXT;
    ALTER TABLE cached_foods ADD COLUMN allergens TEXT;
    ALTER TABLE cached_foods ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cached_foods ADD COLUMN last_verified TEXT;
    ALTER TABLE cached_foods ADD COLUMN category TEXT;
    ALTER TABLE cached_foods ADD COLUMN source_label TEXT;

    CREATE INDEX IF NOT EXISTS idx_cached_foods_name ON cached_foods(name);
    CREATE INDEX IF NOT EXISTS idx_cached_foods_brand_name ON cached_foods(brand, name);
    CREATE INDEX IF NOT EXISTS idx_cached_foods_preparation ON cached_foods(preparation_state);
    CREATE INDEX IF NOT EXISTS idx_cached_foods_restaurant ON cached_foods(restaurant);
  `);
}
