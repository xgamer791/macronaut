import { v } from 'convex/values';

/** Mirrors `Nutrition` in src/domain/types.ts. Every field except calories is
 * optional because provider data is frequently incomplete. */
export const nutritionValidator = v.object({
  calories: v.number(),
  protein: v.optional(v.number()),
  carbs: v.optional(v.number()),
  fat: v.optional(v.number()),
  fiber: v.optional(v.number()),
  sugar: v.optional(v.number()),
  saturatedFat: v.optional(v.number()),
  sodium: v.optional(v.number()),
  cholesterol: v.optional(v.number()),
  micros: v.optional(v.record(v.string(), v.object({ amount: v.number(), unit: v.string() }))),
});

export const sourceTypeValidator = v.union(
  v.literal('provider'),
  v.literal('custom'),
  v.literal('manual'),
  v.literal('recipe'),
  v.literal('saved_meal'),
  v.literal('quick'),
);

export const dayTypeValidator = v.union(v.literal('training'), v.literal('rest'));

export const goalModeValidator = v.union(
  v.literal('same-daily'),
  v.literal('per-weekday'),
  v.literal('training-rest'),
);

export const weeklyModeValidator = v.union(v.literal('sum-daily'), v.literal('custom'));

/** Fields of a goal config other than its id and ownership. */
export const goalConfigFields = {
  effectiveFrom: v.string(),
  mode: goalModeValidator,
  baseTarget: nutritionValidator,
  perWeekday: v.optional(v.array(v.union(v.null(), nutritionValidator))),
  training: v.optional(nutritionValidator),
  rest: v.optional(nutritionValidator),
  trainingDays: v.optional(v.array(v.number())),
  weeklyMode: weeklyModeValidator,
  weeklyTarget: v.optional(nutritionValidator),
};

export const activityTypeValidator = v.union(
  v.literal('cardio'),
  v.literal('strength'),
  v.literal('sports'),
  v.literal('mobility'),
  v.literal('other'),
);

export const activityIntensityValidator = v.union(
  v.literal('easy'),
  v.literal('moderate'),
  v.literal('hard'),
);

export const activitySourceValidator = v.union(
  v.literal('manual'),
  v.literal('apple_watch'),
  v.literal('healthkit'),
);

/** Items inside a saved meal or recipe. Embedded in the parent document
 * because they are always read and written together. */
export const collectionItemValidator = v.object({
  id: v.string(),
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  nutrition: nutritionValidator,
  sourceType: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  position: v.number(),
});

/** What the client sends when creating or replacing items. */
export const collectionItemInputValidator = v.object({
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  nutrition: nutritionValidator,
  sourceType: v.optional(v.string()),
  sourceId: v.optional(v.string()),
});

export const customFoodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  barcode: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  servingQty: v.number(),
  servingUnit: v.string(),
  gramsPerServing: v.optional(v.number()),
  nutrition: nutritionValidator,
  notes: v.optional(v.string()),
  favorite: v.boolean(),
  sourceProvider: v.optional(v.string()),
  sourceId: v.optional(v.string()),
};

export const cachedFoodFields = {
  provider: v.string(),
  providerId: v.string(),
  name: v.string(),
  brand: v.optional(v.string()),
  restaurant: v.optional(v.string()),
  barcode: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  servingQty: v.optional(v.number()),
  servingUnit: v.optional(v.string()),
  gramsPerServing: v.optional(v.number()),
  nutritionPer100g: v.optional(nutritionValidator),
  nutritionPerServing: v.optional(nutritionValidator),
  preparationState: v.optional(v.string()),
  ingredients: v.optional(v.array(v.string())),
  allergens: v.optional(v.array(v.string())),
  verified: v.optional(v.boolean()),
  lastVerified: v.optional(v.string()),
  category: v.optional(v.string()),
  sourceLabel: v.optional(v.string()),
  flagged: v.boolean(),
  confidence: v.optional(v.number()),
  servingBasis: v.optional(v.string()),
  corrected: v.optional(v.boolean()),
  cachedAt: v.string(),
};

export const diaryEntryFields = {
  date: v.string(),
  meal: v.string(),
  time: v.optional(v.string()),
  name: v.string(),
  brand: v.optional(v.string()),
  sourceType: sourceTypeValidator,
  sourceId: v.optional(v.string()),
  quantity: v.number(),
  unit: v.string(),
  servingDesc: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  nutrition: nutritionValidator,
  notes: v.optional(v.string()),
};

export const activityEntryFields = {
  date: v.string(),
  name: v.string(),
  activityType: activityTypeValidator,
  durationMin: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  caloriesBurned: v.number(),
  intensity: v.optional(activityIntensityValidator),
  notes: v.optional(v.string()),
  sourceType: activitySourceValidator,
  sourceId: v.optional(v.string()),
};
