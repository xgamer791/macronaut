import { Nutrition } from '@/domain/types';
import { ServingUnit } from '@/domain/serving';
import { DayKey } from '@/utils/date';

export type SourceType = 'provider' | 'custom' | 'manual' | 'recipe' | 'saved_meal' | 'quick';

export interface DiaryEntry {
  id: string;
  date: DayKey;
  meal: string;
  time?: string;
  name: string;
  brand?: string;
  sourceType: SourceType;
  sourceId?: string;
  quantity: number;
  unit: string;
  servingDesc?: string;
  /** TOTAL nutrition for this entry (already scaled to the portion) —
   * snapshotted at log time so later food edits never rewrite history. */
  nutrition: Nutrition;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFood {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  servingQty: number;
  servingUnit: ServingUnit | string;
  gramsPerServing?: number;
  /** Per one serving. */
  nutrition: Nutrition;
  notes?: string;
  favorite: boolean;
  sourceProvider?: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedFood {
  provider: 'usda' | 'off';
  providerId: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  servingQty?: number;
  servingUnit?: string;
  gramsPerServing?: number;
  nutritionPer100g?: Nutrition;
  nutritionPerServing?: Nutrition;
  flagged: boolean;
  cachedAt: string;
}

export interface SavedMealItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Total nutrition for the item's quantity. */
  nutrition: Nutrition;
  sourceType?: string;
  sourceId?: string;
  position: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  imageUrl?: string;
  servings: number;
  notes?: string;
  favorite: boolean;
  items: SavedMealItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Total nutrition for the ingredient's quantity. */
  nutrition: Nutrition;
  sourceType?: string;
  sourceId?: string;
  position: number;
}

export interface Recipe {
  id: string;
  name: string;
  imageUrl?: string;
  servings: number;
  notes?: string;
  favorite: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface MealCategory {
  id: string;
  name: string;
  position: number;
  builtin: boolean;
}

export interface HistoryItem {
  foodKey: string;
  name: string;
  meal: string;
  loggedAt: string;
}
