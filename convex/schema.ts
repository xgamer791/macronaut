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
  fitnessGroupFields,
  profileFields,
  profilePhotoFields,
  profilePostFields,
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

  /** One profile page per account. The only table anyone other than its owner
   * can read, and only while `isPublic` — `convex/profiles.ts` is the single
   * place that decides, and it hands back a narrowed shape rather than the
   * row. At most one row per user; `by_handle` is the public lookup. */
  profiles: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...profileFields,
  })
    .index('by_user', ['userId'])
    .index('by_handle', ['handleLower']),

  /** Posts on a user's own profile page. Public exactly when the profile is. */
  profilePosts: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...profilePostFields,
  }).index('by_user_created', ['userId', 'createdAt']),

  /** One account following another. `userId` is the follower — they own the
   * row — and `followeeId` is who they follow. Counts on a profile page are
   * just the two index scans; following a private profile is refused. */
  profileFollows: defineTable({
    userId: v.id('users'),
    followeeId: v.id('users'),
    createdAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_followee', ['followeeId'])
    .index('by_user_followee', ['userId', 'followeeId']),

  /** One durable direct conversation for each pair of Macronaut accounts. */
  directChats: defineTable({
    userOneId: v.id('users'),
    userTwoId: v.id('users'),
    pairKey: v.string(),
    userOneReadAt: v.optional(v.string()),
    userTwoReadAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_pair', ['pairKey'])
    .index('by_user_one_updated', ['userOneId', 'updatedAt'])
    .index('by_user_two_updated', ['userTwoId', 'updatedAt']),

  /** Messages belong to a direct chat and survive logout with the account. */
  chatMessages: defineTable({
    chatId: v.id('directChats'),
    senderId: v.id('users'),
    body: v.string(),
    createdAt: v.string(),
  })
    .index('by_chat_created', ['chatId', 'createdAt'])
    .index('by_sender', ['senderId']),

  /** Durable in-app events shown by the header bell. The recipient owns read
   * state; the actor is the account that caused the event. */
  notifications: defineTable({
    recipientId: v.id('users'),
    actorId: v.id('users'),
    kind: v.union(
      v.literal('friend_request'),
      v.literal('friend_accepted'),
      v.literal('chat_message'),
    ),
    chatId: v.optional(v.id('directChats')),
    body: v.optional(v.string()),
    readAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_recipient_created', ['recipientId', 'createdAt'])
    .index('by_recipient_chat', ['recipientId', 'chatId'])
    .index('by_recipient_kind_actor', ['recipientId', 'kind', 'actorId'])
    .index('by_actor', ['actorId']),

  /** Photos on a profile wall. Public ones are visible on a public profile;
   * private ones stay on the owner's wall only. */
  profilePhotos: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...profilePhotoFields,
  }).index('by_user_created', ['userId', 'createdAt']),

  /** One account liking a wall photo. `userId` is the person who liked it. */
  photoLikes: defineTable({
    userId: v.id('users'),
    photoId: v.id('profilePhotos'),
    createdAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_photo', ['photoId'])
    .index('by_user_photo', ['userId', 'photoId']),

  /** A comment on a wall photo. `userId` is the author. */
  photoComments: defineTable({
    userId: v.id('users'),
    photoId: v.id('profilePhotos'),
    body: v.string(),
    createdAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_photo_created', ['photoId', 'createdAt']),

  /** Fitness groups a profile can belong to. `userId` is the owner. */
  fitnessGroups: defineTable({
    userId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
    ...fitnessGroupFields,
  })
    .index('by_user', ['userId'])
    .index('by_handle', ['handleLower']),

  /** Membership in a fitness group. `userId` is the member. */
  groupMembers: defineTable({
    userId: v.id('users'),
    groupId: v.id('fitnessGroups'),
    role: v.union(v.literal('owner'), v.literal('member')),
    createdAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId'])
    .index('by_user_group', ['userId', 'groupId']),

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
