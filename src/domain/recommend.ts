import { caloriesFromMacros } from './nutrition';
import { ActivityLevel, BiologicalSex, GoalType, NutrientTargets } from './types';

export interface RecommendationInput {
  age: number;
  sex: BiologicalSex;
  /** cm */
  height: number;
  /** kg */
  weight: number;
  /** kg — used only to sanity-direct the goal adjustment. */
  goalWeight?: number;
  activity: ActivityLevel;
  goalType: GoalType;
  /** Desired weekly weight change in kg (positive = gain). Defaults by goal
   * type when omitted. */
  weeklyRateKg?: number;
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

/** ~7700 kcal per kg of body weight change (≈3500 kcal/lb). */
const KCAL_PER_KG = 7700;

const DEFAULT_WEEKLY_RATE: Record<GoalType, number> = {
  lose: -0.5,
  maintain: 0,
  gain: 0.35,
  muscle: 0.25,
};

/** Macro split (protein g/kg, fat share of calories) by goal type. Carbs
 * fill the remainder. Senior defaults, all user-overridable. */
const SPLIT: Record<GoalType, { proteinPerKg: number; fatShare: number }> = {
  lose: { proteinPerKg: 1.8, fatShare: 0.25 },
  maintain: { proteinPerKg: 1.4, fatShare: 0.3 },
  gain: { proteinPerKg: 1.6, fatShare: 0.3 },
  muscle: { proteinPerKg: 2.0, fatShare: 0.25 },
};

export interface Recommendation {
  bmr: number;
  tdee: number;
  targets: NutrientTargets;
}

/** Mifflin-St Jeor BMR × activity → TDEE → goal adjustment → macro split.
 * Calories are floored at a safe minimum (1200). Recommendations only —
 * every value is user-editable. */
export function recommendTargets(input: RecommendationInput): Recommendation {
  const { age, sex, height, weight, activity, goalType } = input;
  const bmr =
    10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];

  const rate = input.weeklyRateKg ?? DEFAULT_WEEKLY_RATE[goalType];
  const dailyAdjustment = (rate * KCAL_PER_KG) / 7;
  const calories = Math.max(Math.round(tdee + dailyAdjustment), 1200);

  const split = SPLIT[goalType];
  const protein = Math.round(split.proteinPerKg * weight);
  const fat = Math.round((calories * split.fatShare) / 9);
  const remainingKcal = Math.max(calories - caloriesFromMacros(protein, 0, fat), 0);
  const carbs = Math.round(remainingKcal / 4);

  const targets: NutrientTargets = {
    calories,
    protein,
    carbs,
    fat,
    fiber: sex === 'male' ? 38 : 25,
    sugar: Math.round((calories * 0.1) / 4),
    sodium: 2300,
    cholesterol: 300,
  };

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), targets };
}
