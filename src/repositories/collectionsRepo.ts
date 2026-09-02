import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Nutrition } from '@/domain/types';
import { sumNutrition, scaleNutrition } from '@/domain/nutrition';
import { clean, ConvexCaller } from './convexCall';
import { Recipe, RecipeIngredient, SavedMeal, SavedMealItem } from './types';

export interface CollectionItemInput {
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  sourceType?: string;
  sourceId?: string;
}

export interface CollectionInput {
  name: string;
  imageUrl?: string;
  servings: number;
  notes?: string;
  items: CollectionItemInput[];
}

export interface CollectionRepo<T extends SavedMeal | Recipe> {
  list(query?: string): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: CollectionInput): Promise<T>;
  update(id: string, input: Partial<CollectionInput>): Promise<T>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<T>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  /** Total nutrition across all items. */
  totalNutrition(entity: T): Nutrition;
  /** Nutrition for one serving (total ÷ servings). */
  perServing(entity: T): Nutrition;
}

export type SavedMealRepo = CollectionRepo<SavedMeal>;
export type RecipeRepo = CollectionRepo<Recipe>;

function itemsOf(entity: SavedMeal | Recipe): (SavedMealItem | RecipeIngredient)[] {
  return 'items' in entity ? entity.items : entity.ingredients;
}

function totalNutrition(entity: SavedMeal | Recipe): Nutrition {
  return sumNutrition(itemsOf(entity).map((i) => i.nutrition));
}

function perServing(entity: SavedMeal | Recipe): Nutrition {
  const total = totalNutrition(entity);
  return entity.servings > 0 ? scaleNutrition(total, 1 / entity.servings) : total;
}

/** `imageUrl: undefined` in a patch means "leave it"; the server takes null
 * for "clear it". The app only ever sets a new value or leaves it alone. */
function toPatch(input: Partial<CollectionInput>) {
  return clean({
    name: input.name,
    imageUrl: input.imageUrl,
    servings: input.servings,
    notes: input.notes,
    items: input.items,
  });
}

export function createSavedMealRepo(convex: ConvexCaller): SavedMealRepo {
  const mealId = (id: string) => id as Id<'savedMeals'>;
  return {
    list: (query) => convex.query(api.savedMeals.list, clean({ query })),
    get: (id) => convex.query(api.savedMeals.get, { id: mealId(id) }),
    create: (input) => convex.mutation(api.savedMeals.create, clean(input)),
    update: (id, input) =>
      convex.mutation(api.savedMeals.update, { id: mealId(id), patch: toPatch(input) }),
    async remove(id) {
      await convex.mutation(api.savedMeals.remove, { id: mealId(id) });
    },
    duplicate: (id) => convex.mutation(api.savedMeals.duplicate, { id: mealId(id) }),
    async setFavorite(id, favorite) {
      await convex.mutation(api.savedMeals.setFavorite, { id: mealId(id), favorite });
    },
    totalNutrition,
    perServing,
  };
}

export function createRecipeRepo(convex: ConvexCaller): RecipeRepo {
  const recipeId = (id: string) => id as Id<'recipes'>;
  return {
    list: (query) => convex.query(api.recipes.list, clean({ query })),
    get: (id) => convex.query(api.recipes.get, { id: recipeId(id) }),
    create: (input) => convex.mutation(api.recipes.create, clean(input)),
    update: (id, input) =>
      convex.mutation(api.recipes.update, { id: recipeId(id), patch: toPatch(input) }),
    async remove(id) {
      await convex.mutation(api.recipes.remove, { id: recipeId(id) });
    },
    duplicate: (id) => convex.mutation(api.recipes.duplicate, { id: recipeId(id) }),
    async setFavorite(id, favorite) {
      await convex.mutation(api.recipes.setFavorite, { id: recipeId(id), favorite });
    },
    totalNutrition,
    perServing,
  };
}
