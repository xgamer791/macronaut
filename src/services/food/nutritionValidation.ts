import { caloriesFromMacros } from '@/domain/nutrition';
import { Nutrition } from '@/domain/types';

/** NutritionValidationService — sanity-checks a nutrition panel against the
 * serving it claims to describe. Pure and fully unit-tested. Catches the two
 * failure classes behind wrong scanned data: physically impossible values,
 * and internally inconsistent values (macros that don't add up to the listed
 * calories, or a serving-basis mismatch that inflated the numbers). */

export type ValidationWarning =
  | 'negative-values'
  | 'macro-mass-exceeds-serving'
  | 'fiber-exceeds-carbs'
  | 'sugar-exceeds-carbs'
  | 'calorie-macro-mismatch'
  | 'impossible-calorie-density'
  | 'protein-implausible'
  | 'missing-serving-size'
  | 'incomplete-nutrition';

export type Severity = 'ok' | 'warn' | 'suspect';

export interface ValidationResult {
  warnings: ValidationWarning[];
  severity: Severity;
  /** |listed − macro-derived| / listed, when both are known. */
  macroCalorieDelta?: number;
}

const SUSPECT: ValidationWarning[] = [
  'negative-values',
  'macro-mass-exceeds-serving',
  'impossible-calorie-density',
  'protein-implausible',
];

/** Human-readable explanation for a warning (surfaced subtly in the UI). */
export const WARNING_LABELS: Record<ValidationWarning, string> = {
  'negative-values': 'Contains negative values',
  'macro-mass-exceeds-serving': 'Macros weigh more than the serving',
  'fiber-exceeds-carbs': 'Fiber exceeds total carbs',
  'sugar-exceeds-carbs': 'Sugar exceeds total carbs',
  'calorie-macro-mismatch': "Calories don't match the macros",
  'impossible-calorie-density': 'Calorie density is physically impossible',
  'protein-implausible': 'Protein is implausibly high for this weight',
  'missing-serving-size': 'No serving size on record',
  'incomplete-nutrition': 'Incomplete nutrition panel',
};

export interface ValidateOptions {
  /** The serving is a drinkable liquid (ml basis) — tightens the plausible
   * protein density and calorie density, since no beverage is as dense as a
   * solid. Catches crowd-sourced shakes with impossible macros. */
  isLiquid?: boolean;
}

/** Validate a nutrition panel. `servingGrams` is the mass (or ml, treated as
 * grams for density) the panel describes; omit if unknown. */
export function validateNutrition(
  n: Nutrition,
  servingGrams?: number,
  opts: ValidateOptions = {},
): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const protein = n.protein ?? 0;
  const carbs = n.carbs ?? 0;
  const fat = n.fat ?? 0;
  const fiber = n.fiber ?? 0;
  const sugar = n.sugar ?? 0;

  const anyNegative = [n.calories, n.protein, n.carbs, n.fat, n.fiber, n.sugar].some(
    (v) => v !== undefined && v < 0,
  );
  if (anyNegative) warnings.push('negative-values');

  if (n.protein === undefined && n.carbs === undefined && n.fat === undefined) {
    warnings.push('incomplete-nutrition');
  }

  if (servingGrams === undefined || servingGrams <= 0) {
    warnings.push('missing-serving-size');
  } else {
    // Macros can never outweigh the serving they came from (+2% tolerance).
    const macroMass = protein + carbs + fat;
    if (macroMass > servingGrams * 1.02) warnings.push('macro-mass-exceeds-serving');

    // Solids can't exceed pure fat's 9 kcal/g; drinkable liquids ~4.6 kcal/ml.
    const maxDensity = opts.isLiquid ? 4.6 : 9.3;
    if (n.calories / servingGrams > maxDensity) warnings.push('impossible-calorie-density');

    // Solids cap ~90% protein by mass; no beverage exceeds ~20 g protein/100 ml.
    const maxProteinPer100 = opts.isLiquid ? 20 : 90;
    if ((protein / servingGrams) * 100 > maxProteinPer100) warnings.push('protein-implausible');
  }

  // Fiber and sugar are subsets of carbohydrate.
  if (fiber > carbs * 1.05 && fiber > 1) warnings.push('fiber-exceeds-carbs');
  if (sugar > carbs * 1.05 && sugar > 1) warnings.push('sugar-exceeds-carbs');

  // Calories vs macro-derived calories (4/4/9). Fiber and sugar alcohols make
  // small deltas normal; >30% means the panel or serving basis is wrong.
  let macroCalorieDelta: number | undefined;
  if (n.calories > 0 && (n.protein !== undefined || n.carbs !== undefined || n.fat !== undefined)) {
    const derived = caloriesFromMacros(protein, carbs, fat);
    macroCalorieDelta = Math.abs(n.calories - derived) / n.calories;
    if (macroCalorieDelta > 0.3) warnings.push('calorie-macro-mismatch');
  }

  const severity: Severity = warnings.some((w) => SUSPECT.includes(w))
    ? 'suspect'
    : warnings.length > 0
      ? 'warn'
      : 'ok';

  return { warnings, severity, macroCalorieDelta };
}
