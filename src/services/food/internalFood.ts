import { Nutrition } from '@/domain/types';
import { scaleNutrition } from '@/domain/nutrition';
import { detectPreparationState } from './preparation';
import { NormalizedFood } from './normalize';
import {
  ConfidenceLevel,
  FoodCategory,
  PreparationState,
  ProviderFood,
  ProviderId,
  confidenceLevelFromScore,
} from './types';

/** Standardized internal food schema used across cache, ranking, and UI. */

export type VerifiedStatus = 'verified' | 'unverified' | 'user_corrected';

export interface InternalFood {
  id: string;
  name: string;
  brand?: string;
  restaurant?: string;
  barcode?: string;
  preparationState: PreparationState;
  servingSize?: string;
  servingWeightGrams?: number;
  calories: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  source: ProviderId;
  confidenceScore: number;
  verifiedStatus: VerifiedStatus;
  image?: string;
  ingredients?: string[];
  allergens?: string[];
  lastVerifiedDate?: string;
  category?: FoodCategory;
  confidenceLevel: ConfidenceLevel;
}

function pickPanel(food: ProviderFood | NormalizedFood): {
  serving?: Nutrition;
  per100?: Nutrition;
  grams?: number;
  label?: string;
} {
  if ('perServing' in food) {
    const nf = food as NormalizedFood;
    return {
      serving: nf.perServing,
      per100: nf.per100g,
      grams: nf.gramsPerServing,
      label: nf.servingLabel,
    };
  }
  const pf = food as ProviderFood;
  return {
    serving: pf.nutritionPerServing,
    per100: pf.nutritionPer100g,
    grams: pf.gramsPerServing,
    label: pf.servingLabel,
  };
}

function derivePer100(
  serving: Nutrition | undefined,
  per100: Nutrition | undefined,
  grams: number | undefined,
): Nutrition | undefined {
  if (per100) return per100;
  if (serving && grams && grams > 0) return scaleNutrition(serving, 100 / grams);
  return undefined;
}

function verifiedStatusOf(food: ProviderFood | NormalizedFood, confidence: number): VerifiedStatus {
  if ('verified' in food && (food as ProviderFood).verified) return 'verified';
  if (confidence >= 0.95) return 'verified';
  return 'unverified';
}

function inferCategory(food: ProviderFood | NormalizedFood): FoodCategory | undefined {
  if ('category' in food && food.category) return food.category;
  const provider = food.provider;
  if (provider === 'restaurant' || ('restaurant' in food && food.restaurant)) return 'restaurant';
  if (provider === 'local' || food.isGeneric) return 'generic';
  if (food.brand || food.barcode) return 'packaged';
  return undefined;
}

/** Convert a NormalizedFood or ProviderFood into the InternalFood schema. */
export function toInternalFood(
  food: ProviderFood | NormalizedFood,
  opts: { confidence?: number; verifiedStatus?: VerifiedStatus } = {},
): InternalFood {
  const { serving, per100, grams, label } = pickPanel(food);
  const display = serving ?? per100 ?? { calories: 0 };
  const per100Resolved = derivePer100(serving, per100, grams);
  const confidence =
    opts.confidence ??
    ('confidence' in food ? (food as ProviderFood).confidence : undefined) ??
    0.5;
  const prep =
    ('preparationState' in food && food.preparationState) ||
    detectPreparationState(food.name);
  const pf = food as ProviderFood;
  const verified = opts.verifiedStatus ?? verifiedStatusOf(food, confidence);

  // Serving weight is required for verified foods when available — prefer grams.
  const servingWeightGrams = grams && grams > 0 ? grams : undefined;

  return {
    id: `${food.provider}:${food.id}`,
    name: food.name,
    brand: food.brand,
    restaurant: pf.restaurant,
    barcode: food.barcode,
    preparationState: prep,
    servingSize: label,
    servingWeightGrams,
    calories: display.calories,
    protein: display.protein,
    carbohydrates: display.carbs,
    fat: display.fat,
    fiber: display.fiber,
    sugar: display.sugar,
    saturatedFat: display.saturatedFat,
    sodium: display.sodium,
    caloriesPer100g: per100Resolved?.calories,
    proteinPer100g: per100Resolved?.protein,
    carbsPer100g: per100Resolved?.carbs,
    fatPer100g: per100Resolved?.fat,
    source: food.provider,
    confidenceScore: confidence,
    verifiedStatus: verified,
    image: food.imageUrl ?? pf.imageUrl,
    ingredients: pf.ingredients,
    allergens: pf.allergens,
    lastVerifiedDate: pf.lastVerified,
    category: inferCategory(food),
    confidenceLevel: confidenceLevelFromScore(confidence),
  };
}
