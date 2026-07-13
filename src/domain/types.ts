/** Core nutrition value object. All macro/micro amounts are per the serving
 * they describe; `calories` in kcal, macros/fiber/sugar in grams,
 * sodium/cholesterol in milligrams. Every field except calories is optional —
 * provider data is frequently incomplete and the app must never crash over a
 * missing optional field. */
export interface Nutrition {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
  /** Extra micronutrients keyed by canonical name, value + unit as provided. */
  micros?: Record<string, { amount: number; unit: string }>;
}

export const MACRO_KEYS = [
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
  'cholesterol',
] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/** kcal per gram of each energy-yielding macro. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type GoalType = 'lose' | 'maintain' | 'gain' | 'muscle';

export type BiologicalSex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';

/** A full set of daily targets. Same shape as Nutrition but calories is the
 * headline target and macro fields are targets, not consumed amounts. */
export type NutrientTargets = Nutrition;

export type WeekStart = 'sunday' | 'monday';

export type UnitSystem = 'us' | 'metric';
