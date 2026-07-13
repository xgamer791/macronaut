import { Database } from '@/db/driver';
import { Nutrition } from '@/domain/types';
import { CachedFood, CustomFood } from './types';
import { newId, nowIso, safeParse } from './util';

interface CustomRow {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  image_url: string | null;
  serving_qty: number;
  serving_unit: string;
  grams_per_serving: number | null;
  nutrition: string;
  notes: string | null;
  favorite: number;
  source_provider: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function toCustom(r: CustomRow): CustomFood {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? undefined,
    barcode: r.barcode ?? undefined,
    imageUrl: r.image_url ?? undefined,
    servingQty: r.serving_qty,
    servingUnit: r.serving_unit,
    gramsPerServing: r.grams_per_serving ?? undefined,
    nutrition: safeParse<Nutrition>(r.nutrition, { calories: 0 }),
    notes: r.notes ?? undefined,
    favorite: r.favorite === 1,
    sourceProvider: r.source_provider ?? undefined,
    sourceId: r.source_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface CachedRow {
  provider: string;
  provider_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  image_url: string | null;
  serving_qty: number | null;
  serving_unit: string | null;
  grams_per_serving: number | null;
  nutrition_per_100g: string | null;
  nutrition_per_serving: string | null;
  flagged: number;
  cached_at: string;
}

function toCached(r: CachedRow): CachedFood {
  return {
    provider: r.provider as CachedFood['provider'],
    providerId: r.provider_id,
    name: r.name,
    brand: r.brand ?? undefined,
    barcode: r.barcode ?? undefined,
    imageUrl: r.image_url ?? undefined,
    servingQty: r.serving_qty ?? undefined,
    servingUnit: r.serving_unit ?? undefined,
    gramsPerServing: r.grams_per_serving ?? undefined,
    nutritionPer100g: r.nutrition_per_100g
      ? safeParse<Nutrition | undefined>(r.nutrition_per_100g, undefined)
      : undefined,
    nutritionPerServing: r.nutrition_per_serving
      ? safeParse<Nutrition | undefined>(r.nutrition_per_serving, undefined)
      : undefined,
    flagged: r.flagged === 1,
    cachedAt: r.cached_at,
  };
}

export type NewCustomFood = Omit<CustomFood, 'id' | 'createdAt' | 'updatedAt'>;

export interface FoodRepo {
  // Custom foods
  listCustomFoods(query?: string): Promise<CustomFood[]>;
  getCustomFood(id: string): Promise<CustomFood | null>;
  addCustomFood(food: NewCustomFood): Promise<CustomFood>;
  updateCustomFood(id: string, patch: Partial<NewCustomFood>): Promise<CustomFood>;
  deleteCustomFood(id: string): Promise<void>;
  duplicateCustomFood(id: string): Promise<CustomFood>;
  setCustomFavorite(id: string, favorite: boolean): Promise<void>;
  findCustomByBarcode(barcode: string): Promise<CustomFood | null>;

  // Cached provider foods
  upsertCachedFood(food: CachedFood): Promise<void>;
  getCachedFood(provider: string, providerId: string): Promise<CachedFood | null>;
  findCachedByBarcode(barcode: string): Promise<CachedFood | null>;
  searchCached(query: string, limit?: number): Promise<CachedFood[]>;
  setFlagged(provider: string, providerId: string, flagged: boolean): Promise<void>;

  // Provider-food favorites (custom foods carry their own flag)
  isFavorite(foodKey: string): Promise<boolean>;
  setFavorite(foodKey: string, favorite: boolean): Promise<void>;
  listFavoriteKeys(): Promise<string[]>;
}

export function createFoodRepo(db: Database): FoodRepo {
  const CSELECT = `SELECT id, name, brand, barcode, image_url, serving_qty, serving_unit,
    grams_per_serving, nutrition, notes, favorite, source_provider, source_id, created_at, updated_at
    FROM custom_foods`;
  const KSELECT = `SELECT provider, provider_id, name, brand, barcode, image_url, serving_qty,
    serving_unit, grams_per_serving, nutrition_per_100g, nutrition_per_serving, flagged, cached_at
    FROM cached_foods`;

  async function getCustom(id: string): Promise<CustomFood | null> {
    const row = await db.getFirstAsync<CustomRow>(`${CSELECT} WHERE id = ? AND deleted = 0`, [id]);
    return row ? toCustom(row) : null;
  }

  async function insertCustom(food: NewCustomFood): Promise<CustomFood> {
    if (!food.name.trim()) throw new Error('Food name is required');
    if (food.nutrition.calories < 0) throw new Error('Calories cannot be negative');
    const now = nowIso();
    const full: CustomFood = { ...food, id: newId(), createdAt: now, updatedAt: now };
    await db.runAsync(
      `INSERT INTO custom_foods (id, name, brand, barcode, image_url, serving_qty, serving_unit,
        grams_per_serving, nutrition, notes, favorite, source_provider, source_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id,
        full.name.trim(),
        full.brand ?? null,
        full.barcode ?? null,
        full.imageUrl ?? null,
        full.servingQty,
        String(full.servingUnit),
        full.gramsPerServing ?? null,
        JSON.stringify(full.nutrition),
        full.notes ?? null,
        full.favorite ? 1 : 0,
        full.sourceProvider ?? null,
        full.sourceId ?? null,
        full.createdAt,
        full.updatedAt,
      ],
    );
    return full;
  }

  return {
    async listCustomFoods(query) {
      const rows = query
        ? await db.getAllAsync<CustomRow>(
            `${CSELECT} WHERE deleted = 0 AND (name LIKE ? OR brand LIKE ?) ORDER BY name`,
            [`%${query}%`, `%${query}%`],
          )
        : await db.getAllAsync<CustomRow>(`${CSELECT} WHERE deleted = 0 ORDER BY name`);
      return rows.map(toCustom);
    },

    getCustomFood: getCustom,
    addCustomFood: insertCustom,

    async updateCustomFood(id, patch) {
      const existing = await getCustom(id);
      if (!existing) throw new Error(`Custom food not found: ${id}`);
      const merged: CustomFood = { ...existing, ...patch, id, updatedAt: nowIso() };
      if (!merged.name.trim()) throw new Error('Food name is required');
      if (merged.nutrition.calories < 0) throw new Error('Calories cannot be negative');
      await db.runAsync(
        `UPDATE custom_foods SET name=?, brand=?, barcode=?, image_url=?, serving_qty=?,
          serving_unit=?, grams_per_serving=?, nutrition=?, notes=?, favorite=?, updated_at=?
         WHERE id=?`,
        [
          merged.name.trim(),
          merged.brand ?? null,
          merged.barcode ?? null,
          merged.imageUrl ?? null,
          merged.servingQty,
          String(merged.servingUnit),
          merged.gramsPerServing ?? null,
          JSON.stringify(merged.nutrition),
          merged.notes ?? null,
          merged.favorite ? 1 : 0,
          merged.updatedAt,
          id,
        ],
      );
      return merged;
    },

    async deleteCustomFood(id) {
      await db.runAsync('UPDATE custom_foods SET deleted = 1, updated_at = ? WHERE id = ?', [
        nowIso(),
        id,
      ]);
    },

    async duplicateCustomFood(id) {
      const existing = await getCustom(id);
      if (!existing) throw new Error(`Custom food not found: ${id}`);
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing;
      return insertCustom({ ...rest, name: `${existing.name} (copy)`, favorite: false });
    },

    async setCustomFavorite(id, favorite) {
      await db.runAsync('UPDATE custom_foods SET favorite = ?, updated_at = ? WHERE id = ?', [
        favorite ? 1 : 0,
        nowIso(),
        id,
      ]);
    },

    async findCustomByBarcode(barcode) {
      const row = await db.getFirstAsync<CustomRow>(
        `${CSELECT} WHERE barcode = ? AND deleted = 0 ORDER BY updated_at DESC`,
        [barcode],
      );
      return row ? toCustom(row) : null;
    },

    async upsertCachedFood(food) {
      await db.runAsync(
        `INSERT INTO cached_foods (provider, provider_id, name, brand, barcode, image_url,
          serving_qty, serving_unit, grams_per_serving, nutrition_per_100g, nutrition_per_serving,
          flagged, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_id) DO UPDATE SET
           name=excluded.name, brand=excluded.brand, barcode=excluded.barcode,
           image_url=excluded.image_url, serving_qty=excluded.serving_qty,
           serving_unit=excluded.serving_unit, grams_per_serving=excluded.grams_per_serving,
           nutrition_per_100g=excluded.nutrition_per_100g,
           nutrition_per_serving=excluded.nutrition_per_serving, cached_at=excluded.cached_at`,
        [
          food.provider,
          food.providerId,
          food.name,
          food.brand ?? null,
          food.barcode ?? null,
          food.imageUrl ?? null,
          food.servingQty ?? null,
          food.servingUnit ?? null,
          food.gramsPerServing ?? null,
          food.nutritionPer100g ? JSON.stringify(food.nutritionPer100g) : null,
          food.nutritionPerServing ? JSON.stringify(food.nutritionPerServing) : null,
          food.flagged ? 1 : 0,
          food.cachedAt,
        ],
      );
    },

    async getCachedFood(provider, providerId) {
      const row = await db.getFirstAsync<CachedRow>(
        `${KSELECT} WHERE provider = ? AND provider_id = ?`,
        [provider, providerId],
      );
      return row ? toCached(row) : null;
    },

    async findCachedByBarcode(barcode) {
      const row = await db.getFirstAsync<CachedRow>(
        `${KSELECT} WHERE barcode = ? ORDER BY cached_at DESC`,
        [barcode],
      );
      return row ? toCached(row) : null;
    },

    async searchCached(query, limit = 25) {
      const rows = await db.getAllAsync<CachedRow>(
        `${KSELECT} WHERE name LIKE ? OR brand LIKE ? ORDER BY cached_at DESC LIMIT ?`,
        [`%${query}%`, `%${query}%`, limit],
      );
      return rows.map(toCached);
    },

    async setFlagged(provider, providerId, flagged) {
      await db.runAsync(
        'UPDATE cached_foods SET flagged = ? WHERE provider = ? AND provider_id = ?',
        [flagged ? 1 : 0, provider, providerId],
      );
    },

    async isFavorite(foodKey) {
      const row = await db.getFirstAsync<{ food_key: string }>(
        'SELECT food_key FROM favorites WHERE food_key = ?',
        [foodKey],
      );
      return row !== null;
    },

    async setFavorite(foodKey, favorite) {
      if (favorite) {
        await db.runAsync(
          'INSERT INTO favorites (food_key, created_at) VALUES (?, ?) ON CONFLICT(food_key) DO NOTHING',
          [foodKey, nowIso()],
        );
      } else {
        await db.runAsync('DELETE FROM favorites WHERE food_key = ?', [foodKey]);
      }
    },

    async listFavoriteKeys() {
      const rows = await db.getAllAsync<{ food_key: string }>(
        'SELECT food_key FROM favorites ORDER BY created_at DESC',
      );
      return rows.map((r) => r.food_key);
    },
  };
}
