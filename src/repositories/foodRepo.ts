import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { clean, ConvexCaller } from './convexCall';
import { CachedFood, CustomFood } from './types';

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
  /** One round trip for a whole result set. */
  upsertCachedFoods(foods: CachedFood[]): Promise<void>;
  getCachedFood(provider: string, providerId: string): Promise<CachedFood | null>;
  findCachedByBarcode(barcode: string): Promise<CachedFood | null>;
  searchCached(query: string, limit?: number): Promise<CachedFood[]>;
  setFlagged(provider: string, providerId: string, flagged: boolean): Promise<void>;

  // Provider-food favorites (custom foods carry their own flag)
  isFavorite(foodKey: string): Promise<boolean>;
  setFavorite(foodKey: string, favorite: boolean): Promise<void>;
  listFavoriteKeys(): Promise<string[]>;
}

const customId = (id: string) => id as Id<'customFoods'>;

/** The server keeps `provider` and friends as plain strings; the app narrows
 * them to its own unions, which is what the SQLite rows did before. */
const asCached = (row: Awaited<ReturnType<ConvexCaller['query']>>) => row as CachedFood;

export function createFoodRepo(convex: ConvexCaller): FoodRepo {
  const repo: FoodRepo = {
    listCustomFoods: (query) =>
      convex.query(api.foods.listCustom, clean({ query })) as Promise<CustomFood[]>,
    getCustomFood: (id) =>
      convex.query(api.foods.getCustom, { id: customId(id) }) as Promise<CustomFood | null>,
    addCustomFood: (food) =>
      convex.mutation(api.foods.addCustom, clean(toCustomArgs(food))) as Promise<CustomFood>,
    updateCustomFood: (id, patch) =>
      convex.mutation(api.foods.updateCustom, {
        id: customId(id),
        patch: clean(toCustomArgs(patch)),
      }) as Promise<CustomFood>,
    async deleteCustomFood(id) {
      await convex.mutation(api.foods.deleteCustom, { id: customId(id) });
    },
    duplicateCustomFood: (id) =>
      convex.mutation(api.foods.duplicateCustom, { id: customId(id) }) as Promise<CustomFood>,
    async setCustomFavorite(id, favorite) {
      await convex.mutation(api.foods.setCustomFavorite, { id: customId(id), favorite });
    },
    findCustomByBarcode: (barcode) =>
      convex.query(api.foods.findCustomByBarcode, { barcode }) as Promise<CustomFood | null>,

    upsertCachedFood: (food) => repo.upsertCachedFoods([food]),
    async upsertCachedFoods(foods) {
      if (foods.length === 0) return;
      await convex.mutation(api.foods.upsertCachedMany, { foods: clean(foods) });
    },
    async getCachedFood(provider, providerId) {
      const row = await convex.query(api.foods.getCached, { provider, providerId });
      return row ? asCached(row) : null;
    },
    async findCachedByBarcode(barcode) {
      const row = await convex.query(api.foods.findCachedByBarcode, { barcode });
      return row ? asCached(row) : null;
    },
    async searchCached(query, limit) {
      const rows = await convex.query(api.foods.searchCached, clean({ query, limit }));
      return rows.map(asCached);
    },
    async setFlagged(provider, providerId, flagged) {
      await convex.mutation(api.foods.setFlagged, { provider, providerId, flagged });
    },

    isFavorite: (foodKey) => convex.query(api.foods.isFavorite, { foodKey }),
    async setFavorite(foodKey, favorite) {
      await convex.mutation(api.foods.setFavorite, { foodKey, favorite });
    },
    listFavoriteKeys: () => convex.query(api.foods.listFavoriteKeys, {}),
  };
  return repo;
}

/** `servingUnit` is a branded union in the app and a string on the server. */
function toCustomArgs<T extends Partial<NewCustomFood>>(food: T) {
  return {
    ...food,
    servingUnit: food.servingUnit === undefined ? undefined : String(food.servingUnit),
  };
}
