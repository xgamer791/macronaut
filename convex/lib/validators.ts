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

/** Free-form work planned for one day. The labels deliberately have no enum:
 * a runner, climber, lifter, swimmer, or team-sport athlete can all describe
 * their own training without being forced through a preset taxonomy. */
export const scheduledWorkoutValidator = v.object({
  id: v.string(),
  label: v.string(),
  macroLabel: v.optional(v.string()),
  sets: v.optional(v.number()),
});

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

/** What a profile owner may change. Ownership, the handle lookup key, the
 * image ids and the timestamps are all set by the server. */
export const profileEditableFields = {
  displayName: v.optional(v.string()),
  bio: v.optional(v.string()),
  location: v.optional(v.string()),
  primarySport: v.optional(v.string()),
};

/** Profile fields other than ownership and timestamps. `handleLower` is
 * derived from `handle` so the by-handle index is case-insensitive, and the
 * images are Convex storage ids rather than URLs so deleting an account also
 * deletes the files. */
export const profileFields = {
  handle: v.string(),
  handleLower: v.string(),
  ...profileEditableFields,
  avatarId: v.optional(v.id('_storage')),
  bannerId: v.optional(v.id('_storage')),
  /** The gym this person calls home. Set only through `gyms.claim` / `clear`
   * (never `profiles.update`), so a profile can only ever point at a row the
   * gym search wrote. */
  homeGymId: v.optional(v.id('gyms')),
  /** When false the profile page stays owner-only. Mutual friends may still
   * receive its posts through the separately authorized friends feed. */
  isPublic: v.boolean(),
};

export const profilePostFields = {
  body: v.string(),
  imageId: v.optional(v.id('_storage')),
  /** Optional for posts created before reactions and comments shipped. */
  likeCount: v.optional(v.number()),
  commentCount: v.optional(v.number()),
};

export const profilePhotoFields = {
  imageId: v.id('_storage'),
  caption: v.optional(v.string()),
  isPublic: v.boolean(),
};

/** A photo or clip on a message. The file is a storage id, never a URL, so
 * deleting the message can delete the file; the pixel size lets a bubble
 * reserve the right shape before the file loads. Shared by direct chats and
 * group chats so the two never drift. */
export const mediaKindValidator = v.union(v.literal('image'), v.literal('video'));

export const attachmentFields = {
  mediaId: v.optional(v.id('_storage')),
  mediaKind: v.optional(mediaKindValidator),
  mediaWidth: v.optional(v.number()),
  mediaHeight: v.optional(v.number()),
};

export const fitnessGroupFields = {
  name: v.string(),
  handle: v.string(),
  handleLower: v.string(),
  sport: v.optional(v.string()),
  /** Public place label chosen by the owner (for example "Austin, TX"). */
  location: v.optional(v.string()),
  description: v.optional(v.string()),
  isPublic: v.boolean(),
  /** Present only on a gym's one shared group. Such a group has no owner:
   * every seat is a plain member, nobody can edit or delete it, and its
   * `userId` merely records which claim inserted the row. */
  kind: v.optional(v.literal('gym')),
  gymId: v.optional(v.id('gyms')),
  /** When the group's chat last had a message; sorts the conversation list. */
  lastMessageAt: v.optional(v.string()),
};
