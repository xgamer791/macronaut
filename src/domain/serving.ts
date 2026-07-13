import { Nutrition } from './types';
import { scaleNutrition } from './nutrition';

/** Canonical serving units. Weight units convert exactly; volume and count
 * units convert through a food's known gram equivalents when available. */
export type ServingUnit =
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'piece'
  | 'slice'
  | 'container'
  | 'serving'
  | 'custom';

export const WEIGHT_TO_GRAMS: Partial<Record<ServingUnit, number>> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

/** Volume in ml (converted to grams via density, default 1 g/ml). */
export const VOLUME_TO_ML: Partial<Record<ServingUnit, number>> = {
  ml: 1,
  cup: 240,
  tbsp: 15,
  tsp: 5,
};

export interface FoodPortionInfo {
  /** Nutrition per one reference serving of the food. */
  nutritionPerServing: Nutrition;
  /** Grams in one reference serving, when known. */
  gramsPerServing?: number;
  /** g/ml for volume conversion (defaults to 1). */
  density?: number;
  /** Label of the food's own serving ('1 bar', '2 scoops'…). */
  servingLabel?: string;
}

export const ALL_UNITS: ServingUnit[] = [
  'serving',
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'cup',
  'tbsp',
  'tsp',
  'piece',
  'slice',
  'container',
  'custom',
];

/** Units usable for a given food: weight/volume need gramsPerServing to
 * convert; count-style units always work (they alias the serving). */
export function availableUnits(info: FoodPortionInfo): ServingUnit[] {
  const countUnits: ServingUnit[] = ['serving', 'piece', 'slice', 'container', 'custom'];
  if (!info.gramsPerServing || info.gramsPerServing <= 0) return countUnits;
  return ALL_UNITS;
}

/** Convert a chosen (quantity, unit) into the equivalent number of reference
 * servings for the food. Count units are 1:1 with servings. */
export function toServings(quantity: number, unit: ServingUnit, info: FoodPortionInfo): number {
  if (quantity < 0) throw new Error('Quantity cannot be negative');
  const grams = WEIGHT_TO_GRAMS[unit];
  if (grams !== undefined) {
    if (!info.gramsPerServing || info.gramsPerServing <= 0) {
      throw new Error(`Cannot convert ${unit} without a gram serving size`);
    }
    return (quantity * grams) / info.gramsPerServing;
  }
  const ml = VOLUME_TO_ML[unit];
  if (ml !== undefined) {
    if (!info.gramsPerServing || info.gramsPerServing <= 0) {
      throw new Error(`Cannot convert ${unit} without a gram serving size`);
    }
    const density = info.density ?? 1;
    return (quantity * ml * density) / info.gramsPerServing;
  }
  // Count-style units: 1 unit = 1 reference serving.
  return quantity;
}

/** Nutrition for a chosen portion. */
export function portionNutrition(
  quantity: number,
  unit: ServingUnit,
  info: FoodPortionInfo,
): Nutrition {
  return scaleNutrition(info.nutritionPerServing, toServings(quantity, unit, info));
}

/** Human description of a portion, e.g. '2 × 1 cup (480 g)'. */
export function describePortion(
  quantity: number,
  unit: ServingUnit,
  info: FoodPortionInfo,
): string {
  if (unit === 'serving') {
    const label = info.servingLabel ?? 'serving';
    return `${trimNum(quantity)} × ${label}`;
  }
  const grams = WEIGHT_TO_GRAMS[unit];
  if (grams !== undefined && unit !== 'g') {
    return `${trimNum(quantity)} ${unit} (${trimNum(quantity * grams)} g)`;
  }
  return `${trimNum(quantity)} ${unit}`;
}

function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}
