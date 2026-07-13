import { KCAL_PER_GRAM, MACRO_KEYS, Nutrition } from './types';

/** kcal implied by a macro split. */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
}

/** Scale every nutrient by a factor (e.g. servings multiplier or gram ratio).
 * Missing optional fields stay missing — scaling never invents data. */
export function scaleNutrition(n: Nutrition, factor: number): Nutrition {
  const out: Nutrition = { calories: n.calories * factor };
  for (const key of MACRO_KEYS) {
    const v = n[key];
    if (v !== undefined) out[key] = v * factor;
  }
  if (n.micros) {
    out.micros = Object.fromEntries(
      Object.entries(n.micros).map(([k, m]) => [k, { amount: m.amount * factor, unit: m.unit }]),
    );
  }
  return out;
}

/** Sum any number of nutrition values. A field is present in the result if it
 * is present in at least one input (missing values count as 0 there). */
export function sumNutrition(items: Nutrition[]): Nutrition {
  const out: Nutrition = { calories: 0 };
  for (const n of items) {
    out.calories += n.calories;
    for (const key of MACRO_KEYS) {
      const v = n[key];
      if (v !== undefined) out[key] = (out[key] ?? 0) + v;
    }
    if (n.micros) {
      out.micros = out.micros ?? {};
      for (const [k, m] of Object.entries(n.micros)) {
        const prev = out.micros[k];
        out.micros[k] =
          prev && prev.unit === m.unit ? { amount: prev.amount + m.amount, unit: m.unit } : { ...m };
      }
    }
  }
  return out;
}

/** Display rounding: calories to whole numbers, grams/mg to one decimal
 * (dropping a trailing .0). Stored values are never rounded — this is
 * presentation only. */
export function roundForDisplay(value: number, kind: 'calories' | 'grams' = 'grams'): number {
  if (kind === 'calories') return Math.round(value);
  return Math.round(value * 10) / 10;
}
