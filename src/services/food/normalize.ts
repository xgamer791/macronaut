import { Nutrition } from '@/domain/types';
import { scaleNutrition } from '@/domain/nutrition';
import { detectPreparationState } from './preparation';
import { parseServing, ServingBasis, servingReferenceGrams } from './servingParser';
import { validateNutrition, ValidationResult } from './nutritionValidation';
import {
  FoodCategory,
  PreparationState,
  ProviderFood,
  ProviderId,
} from './types';

/** NutritionNormalizationService — turns any provider's raw result into ONE
 * consistent internal food model with an explicit serving basis, both
 * per-100g and per-serving panels resolved, a validation result, and source
 * attribution. Every food shown in the UI passes through here. */

export interface NormalizedFood {
  provider: ProviderId;
  id: string;
  key: string;
  name: string;
  brand?: string;
  restaurant?: string;
  barcode?: string;
  imageUrl?: string;
  isGeneric: boolean;
  /** Verbatim per-100 g panel, when the source provides one. */
  per100g?: Nutrition;
  /** Nutrition for one labeled serving. */
  perServing?: Nutrition;
  gramsPerServing?: number;
  servingLabel?: string;
  servingBasis: ServingBasis;
  /** Whether the reference weight is grams or millilitres (liquids). */
  referenceGrams?: number;
  preparationState: PreparationState;
  ingredients?: string[];
  allergens?: string[];
  verified?: boolean;
  lastVerified?: string;
  dataType?: string;
  category?: FoodCategory;
  validation: ValidationResult;
  sourceLabel: string;
}

const SOURCE_LABEL: Record<ProviderId, string> = {
  usda: 'USDA FoodData Central',
  off: 'Open Food Facts',
  local: 'USDA SR Legacy (built-in)',
  nutritionix: 'Nutritionix',
  fatsecret: 'FatSecret',
  restaurant: 'Restaurant menu',
  custom: 'My Foods',
};

/** Resolve the per-serving panel a food should display, correctly handling
 * whichever basis the provider gave — never double-scaling, never treating
 * per-100 g as per-serving. */
export function resolvePerServing(
  perServing: Nutrition | undefined,
  per100g: Nutrition | undefined,
  gramsPerServing: number | undefined,
): Nutrition | undefined {
  if (perServing) return perServing; // provider gave the label panel directly
  if (per100g && gramsPerServing && gramsPerServing > 0) {
    return scaleNutrition(per100g, gramsPerServing / 100);
  }
  return per100g; // fall back to 100 g as the "serving"
}

export function normalizeFood(
  raw: ProviderFood,
  opts: { servingSize?: string; servingQuantity?: number | string; servingUnit?: string } = {},
): NormalizedFood {
  const parsed = parseServing(opts.servingSize ?? raw.servingLabel, opts.servingQuantity ?? raw.gramsPerServing, opts.servingUnit);
  const gramsPerServing = raw.gramsPerServing ?? parsed.grams ?? parsed.ml;
  const perServing = resolvePerServing(raw.nutritionPerServing, raw.nutritionPer100g, gramsPerServing);

  // Validate against the true reference weight of whatever panel we display.
  const refGrams = raw.nutritionPerServing
    ? servingReferenceGrams(parsed) ?? gramsPerServing
    : raw.nutritionPer100g && !raw.nutritionPerServing
      ? gramsPerServing ?? 100
      : gramsPerServing;
  const isLiquid = parsed.ml !== undefined && parsed.grams === undefined;
  const validation = validateNutrition(
    perServing ?? raw.nutritionPer100g ?? { calories: 0 },
    refGrams,
    { isLiquid },
  );

  const basis: ServingBasis = raw.provider === 'local'
    ? '100g'
    : raw.nutritionPerServing
      ? parsed.basis === 'unknown'
        ? 'serving'
        : parsed.basis
      : raw.nutritionPer100g
        ? '100g'
        : 'unknown';

  return {
    provider: raw.provider,
    id: raw.id,
    key: `${raw.provider}:${raw.id}`,
    name: raw.name,
    brand: raw.brand,
    restaurant: raw.restaurant,
    barcode: raw.barcode,
    imageUrl: raw.imageUrl,
    isGeneric: raw.isGeneric,
    per100g: raw.nutritionPer100g,
    perServing,
    gramsPerServing,
    servingLabel: parsed.label ?? raw.servingLabel,
    servingBasis: basis,
    referenceGrams: refGrams,
    preparationState: raw.preparationState ?? detectPreparationState(raw.name),
    ingredients: raw.ingredients,
    allergens: raw.allergens,
    verified: raw.verified,
    lastVerified: raw.lastVerified,
    dataType: raw.dataType,
    category:
      raw.category ??
      (raw.provider === 'custom'
        ? 'custom'
        : raw.restaurant || raw.provider === 'restaurant'
          ? 'restaurant'
          : raw.isGeneric || raw.provider === 'local'
            ? 'generic'
            : raw.brand || raw.barcode
              ? 'packaged'
              : undefined),
    validation,
    sourceLabel: raw.restaurant
      ? `${SOURCE_LABEL[raw.provider]} · ${raw.restaurant}`
      : SOURCE_LABEL[raw.provider],
  };
}

export const SERVING_BASIS_LABEL: Record<ServingBasis, string> = {
  serving: 'per serving',
  '100g': 'per 100 g',
  '100ml': 'per 100 ml',
  container: 'per container',
  unknown: 'per serving',
};
