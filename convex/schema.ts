import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  activityEntryFields,
  cachedFoodFields,
  collectionItemValidator,
  customFoodFields,
  dayTypeValidator,
  diaryEntryFields,
  goalConfigFields,
} from './lib/validators';

/**
 * Every table the app writes carries a `userId` and is only ever read through
 * an index that starts with it. Functions resolve the user from the verified
 * session (`requireUserId`), never from an argument, so a client cannot name
 * another account's rows. See docs/security.md.
 *
 * `authTables` adds `users`, `authAccounts`, `authSessions`, and the other
 * tables Convex Auth needs.
 */
export default defineSchema({
  ...authTables,

  /** Convex Auth's own `users` table plus the two facts create-account
   * captures and the app never lets anyone change. Written in the same
   * transaction that creates the account (convex/PasswordAccount.ts);
   * optional because accounts created before it existed have neither. */
  users: defineTable({
    ...authTables.users.validator.fields,
    /** ISO `YYYY-MM-DD`. */
    birthday: v.optional(v.string()),
    country: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone']),

  /** Key/value settings, JSON-encoded exactly as the app hands them over —
   * shapes vary per key (profile, meal times, goals, …). */
  settings: defineTable({
    userId: v.id('users'),
    key: v.string(),
    value: v.string(),
  }).index('by_user_key', ['userId', 'key']),

  goalConfigs: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    ...goalConfigFields,
  }).index('by_user_effective', ['userId', 'effectiveFrom']),

  dayTypeMarks: defineTable({
    userId: v.id('users'),
    date: v.string(),
    dayType: dayTypeValidator,
  }).index('by_user_date', ['userId', 'date']),

  /** Only user-created meals live here; the four built-ins are constants. */
  mealCategories: defineTable({
    userId: v.id('users'),
    catId: v.string(),
    name: v.string(),
    position: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_cat', ['userId', 'catId']),

  customFoods: defineTable({
    userId: v.id('users'),
    deleted: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...customFoodFields,
  })
    .index('by_user', ['userId'])
    .index('by_user_barcode', ['userId', 'barcode']),

  /** Per-account cache of provider lookups, so repeat searches and barcode
   * scans resolve without hitting the providers again. */
  cachedFoods: defineTable({
    userId: v.id('users'),
    /** name + brand + restaurant, lowercased, for the search index. */
    searchText: v.string(),
    ...cachedFoodFields,
  })
    .index('by_user_provider', ['userId', 'provider', 'providerId'])
    .index('by_user_barcode', ['userId', 'barcode'])
    .searchIndex('search_text', { searchField: 'searchText', filterFields: ['userId'] }),

  favorites: defineTable({
    userId: v.id('users'),
    foodKey: v.string(),
    createdAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_user_key', ['userId', 'foodKey']),

  diaryEntries: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...diaryEntryFields,
  }).index('by_user_date', ['userId', 'date']),

  savedMeals: defineTable({
    userId: v.id('users'),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    servings: v.number(),
    notes: v.optional(v.string()),
    favorite: v.boolean(),
    deleted: v.boolean(),
    items: v.array(collectionItemValidator),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_user', ['userId']),

  recipes: defineTable({
    userId: v.id('users'),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    servings: v.number(),
    notes: v.optional(v.string()),
    favorite: v.boolean(),
    deleted: v.boolean(),
    ingredients: v.array(collectionItemValidator),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_user', ['userId']),

  foodLogHistory: defineTable({
    userId: v.id('users'),
    foodKey: v.string(),
    name: v.string(),
    meal: v.string(),
    loggedAt: v.string(),
    imageUrl: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_key', ['userId', 'foodKey']),

  searchHistory: defineTable({
    userId: v.id('users'),
    query: v.string(),
    searchedAt: v.string(),
  })
    .index('by_user_query', ['userId', 'query'])
    .index('by_user_time', ['userId', 'searchedAt']),

  activityEntries: defineTable({
    userId: v.id('users'),
    /** Lowercased name so "previous sessions of this workout" is an index scan. */
    nameLower: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...activityEntryFields,
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user_name_date', ['userId', 'nameLower', 'date']),

  dayNotes: defineTable({
    userId: v.id('users'),
    date: v.string(),
    body: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_user_date', ['userId', 'date']),

  /** Frozen set of accounts that may use AI food scan until Pro. Written once
   * by `foodScan.ensureRoster`; later sign-ups are not added. Not user-scoped. */
  aiScanRoster: defineTable({
    userId: v.id('users'),
  }).index('by_user', ['userId']),

  aiScanRosterMeta: defineTable({
    key: v.string(),
    frozenAt: v.string(),
  }).index('by_key', ['key']),
});
