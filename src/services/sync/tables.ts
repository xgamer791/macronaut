/** The single source of truth for which local tables belong to the account and
 * therefore sync to Supabase.
 *
 * Both halves of sync read this list: the local migration builds an outbox
 * trigger per table from it, and the engine pushes and pulls by walking it. A
 * table that is not here never leaves the device.
 *
 * `cached_foods` is deliberately absent. It is a provider cache keyed by
 * (provider, provider_id), identical for every user and refillable from the
 * network, so uploading it would cost bandwidth and buy nothing. `migrations`
 * is local bookkeeping. */

export interface SyncTable {
  /** Local SQLite table name; the Postgres mirror uses the same name. */
  name: string;
  /** Columns forming the row identity, local and remote. */
  pk: string[];
  /** Data columns to copy, excluding the primary key. */
  columns: string[];
  /** True when the table already carries its own soft-delete flag, so a
   * removal is an UPDATE the outbox sees rather than a DELETE. */
  softDelete?: boolean;
  /** Primary-key values that stay on the device. Only meaningful for the
   * key-value `settings` table, where one row can be a secret while the rest
   * of the table is ordinary preferences. */
  excludeKeys?: string[];
}

/**
 * Settings rows that must never leave the device, even though the rest of the
 * table syncs.
 *
 * `grokApiKey` is the user's own xAI credential. It is billable, it is theirs
 * rather than ours, and both the AI screens and the privacy policy tell them
 * it stays on their device. Uploading it to our database would make that a
 * lie and would put someone else's API key in our custody. It is excluded at
 * the trigger, so it never even enters the outbox.
 *
 * `demoDataLoaded` is a development marker with no meaning on another device.
 */
export const DEVICE_ONLY_SETTINGS = ['grokApiKey', 'demoDataLoaded'];

export const SYNC_TABLES: SyncTable[] = [
  {
    name: 'settings',
    pk: ['key'],
    columns: ['value'],
    excludeKeys: DEVICE_ONLY_SETTINGS,
  },
  {
    name: 'goal_configs',
    pk: ['id'],
    columns: ['effective_from', 'created_at', 'payload'],
  },
  { name: 'day_type_marks', pk: ['date'], columns: ['day_type'] },
  {
    name: 'meal_categories',
    pk: ['id'],
    columns: ['name', 'position', 'builtin', 'deleted'],
    softDelete: true,
  },
  {
    name: 'custom_foods',
    pk: ['id'],
    columns: [
      'name',
      'brand',
      'barcode',
      'image_url',
      'serving_qty',
      'serving_unit',
      'grams_per_serving',
      'nutrition',
      'notes',
      'favorite',
      'source_provider',
      'source_id',
      'created_at',
      'updated_at',
      'deleted',
    ],
    softDelete: true,
  },
  {
    name: 'diary_entries',
    pk: ['id'],
    columns: [
      'date',
      'meal',
      'time',
      'name',
      'brand',
      'source_type',
      'source_id',
      'quantity',
      'unit',
      'serving_desc',
      'nutrition',
      'notes',
      'image_url',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'saved_meals',
    pk: ['id'],
    columns: [
      'name',
      'image_url',
      'servings',
      'notes',
      'favorite',
      'created_at',
      'updated_at',
      'deleted',
    ],
    softDelete: true,
  },
  {
    name: 'saved_meal_items',
    pk: ['id'],
    columns: [
      'meal_id',
      'name',
      'quantity',
      'unit',
      'nutrition',
      'source_type',
      'source_id',
      'position',
    ],
  },
  {
    name: 'recipes',
    pk: ['id'],
    columns: [
      'name',
      'image_url',
      'servings',
      'notes',
      'favorite',
      'created_at',
      'updated_at',
      'deleted',
    ],
    softDelete: true,
  },
  {
    name: 'recipe_ingredients',
    pk: ['id'],
    columns: [
      'recipe_id',
      'name',
      'quantity',
      'unit',
      'nutrition',
      'source_type',
      'source_id',
      'position',
    ],
  },
  {
    name: 'food_log_history',
    pk: ['id'],
    columns: ['food_key', 'name', 'meal', 'logged_at', 'image_url'],
  },
  { name: 'search_history', pk: ['query'], columns: ['searched_at'] },
  { name: 'favorites', pk: ['food_key'], columns: ['created_at'] },
  {
    name: 'activity_entries',
    pk: ['id'],
    columns: [
      'date',
      'name',
      'activity_type',
      'duration_min',
      'distance_km',
      'calories_burned',
      'intensity',
      'notes',
      'source_type',
      'source_id',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'day_notes',
    pk: ['id'],
    columns: ['date', 'body', 'created_at', 'updated_at'],
  },
];

export const SYNC_TABLE_NAMES = SYNC_TABLES.map((t) => t.name);

export function syncTable(name: string): SyncTable {
  const table = SYNC_TABLES.find((t) => t.name === name);
  if (!table) throw new Error(`Unknown sync table: ${name}`);
  return table;
}

/** Every column the engine reads or writes for a table, key first. */
export function allColumns(table: SyncTable): string[] {
  return [...table.pk, ...table.columns];
}

/** Stable string identity for a row, used as the outbox key and to match a
 * pulled remote row against the local one. Composite keys are joined with a
 * separator no id in this schema contains. */
export const PK_SEPARATOR = '\u0001';

export function rowKey(table: SyncTable, row: Record<string, unknown>): string {
  return table.pk.map((col) => String(row[col] ?? '')).join(PK_SEPARATOR);
}
