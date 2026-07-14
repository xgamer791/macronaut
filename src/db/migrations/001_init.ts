import { Database } from '../driver';

/** Initial schema. Nutrition values are stored as JSON text — they are
 * read/written as whole objects, never queried by field, and the shape can
 * grow (micros) without schema churn. Everything queried has real columns. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE goal_configs (
      id TEXT PRIMARY KEY,
      effective_from TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX idx_goal_effective ON goal_configs(effective_from);

    CREATE TABLE day_type_marks (
      date TEXT PRIMARY KEY,
      day_type TEXT NOT NULL CHECK (day_type IN ('training','rest'))
    );

    CREATE TABLE meal_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      builtin INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE custom_foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      image_url TEXT,
      serving_qty REAL NOT NULL DEFAULT 1,
      serving_unit TEXT NOT NULL DEFAULT 'serving',
      grams_per_serving REAL,
      nutrition TEXT NOT NULL,
      notes TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      source_provider TEXT,
      source_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_custom_foods_barcode ON custom_foods(barcode);

    CREATE TABLE cached_foods (
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      image_url TEXT,
      serving_qty REAL,
      serving_unit TEXT,
      grams_per_serving REAL,
      nutrition_per_100g TEXT,
      nutrition_per_serving TEXT,
      flagged INTEGER NOT NULL DEFAULT 0,
      cached_at TEXT NOT NULL,
      PRIMARY KEY (provider, provider_id)
    );
    CREATE INDEX idx_cached_foods_barcode ON cached_foods(barcode);

    CREATE TABLE diary_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      meal TEXT NOT NULL,
      time TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      serving_desc TEXT,
      nutrition TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_diary_date ON diary_entries(date);

    CREATE TABLE saved_meals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      servings REAL NOT NULL DEFAULT 1,
      notes TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE saved_meal_items (
      id TEXT PRIMARY KEY,
      meal_id TEXT NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      nutrition TEXT NOT NULL,
      source_type TEXT,
      source_id TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_meal_items_meal ON saved_meal_items(meal_id);

    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      servings REAL NOT NULL DEFAULT 1,
      notes TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      nutrition TEXT NOT NULL,
      source_type TEXT,
      source_id TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_recipe_ing_recipe ON recipe_ingredients(recipe_id);

    CREATE TABLE food_log_history (
      id TEXT PRIMARY KEY,
      food_key TEXT NOT NULL,
      name TEXT NOT NULL,
      meal TEXT NOT NULL,
      logged_at TEXT NOT NULL
    );
    CREATE INDEX idx_hist_key ON food_log_history(food_key);
    CREATE INDEX idx_hist_time ON food_log_history(logged_at);

    CREATE TABLE search_history (
      query TEXT PRIMARY KEY,
      searched_at TEXT NOT NULL
    );

    CREATE TABLE favorites (
      food_key TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);

  // Default meal categories (the standard six).
  // Migration 005 consolidates these to Breakfast · Lunch · Dinner · Snacks.
  const defaults = [
    ['breakfast', 'Breakfast'],
    ['morning-snack', 'Morning snack'],
    ['lunch', 'Lunch'],
    ['afternoon-snack', 'Afternoon snack'],
    ['dinner', 'Dinner'],
    ['evening-snack', 'Evening snack'],
  ] as const;
  for (let i = 0; i < defaults.length; i++) {
    await db.runAsync(
      `INSERT INTO meal_categories (id, name, position, builtin) VALUES (?, ?, ?, 1)`,
      [defaults[i][0], defaults[i][1], i],
    );
  }
}
