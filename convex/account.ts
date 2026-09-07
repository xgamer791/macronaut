import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalQuery, mutation, query, type MutationCtx } from './_generated/server';
import { requireUserId } from './lib/auth';

export type AuthProviderId = 'password' | 'google' | 'apple' | 'email';

/** Email of the signed-in user. Internal so actions can check allow-lists
 * without exposing a second public viewer shape. */
export const viewerEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

/** The signed-in user as the app shows it. The `name` is user-controlled text;
 * it is capped here and again where shown. `birthday` and `country` are set
 * once, when the account is created, and are read-only from here on. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect();
    const providers = new Set(accounts.map((a) => a.provider));
    // Native and web Sign in with Apple share the `apple` account, so one case
    // covers both (convex/AppleNative.ts).
    const provider: AuthProviderId | undefined = providers.has('password')
      ? 'password'
      : providers.has('google')
        ? 'google'
        : providers.has('apple')
          ? 'apple'
          : providers.has('resend-otp')
            ? 'email'
            : undefined;
    return {
      id: userId,
      email: user.email,
      name: user.name?.trim().slice(0, 60) || undefined,
      image: user.image,
      birthday: user.birthday,
      country: user.country,
      provider,
    };
  },
});

/**
 * Whether create-account can still use this address. The password provider
 * keys its `authAccounts` row on the address itself, so a second sign-up on
 * one that is taken fails — the form asks as the address is typed rather than
 * letting someone fill the rest of it in first.
 *
 * Only the password provider counts. An address that reached Macronaut through
 * Google or Apple can still be given a password account of its own, which is
 * what the sign-up call does (tests/convex/passwordSignUp.test.ts), so
 * reporting those as taken would refuse a sign-up the server accepts.
 *
 * This does tell an unauthenticated caller whether an address has an account.
 * Any create-account form gives that away — a taken address cannot be signed
 * up either way — so it is answered here plainly instead of after a round trip
 * that fails. Forgot-password stays deliberately silent (convex/PasswordAccount.ts).
 */
export const passwordAccountExists = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = email.trim().toLowerCase();
    if (!address) return false;
    const account = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) =>
        q.eq('provider', 'password').eq('providerAccountId', address),
      )
      .first();
    return account !== null;
  },
});

/** Rows deleted per call. Convex bounds the work one mutation may do, so a
 * large diary is erased over several calls; the client repeats until `done`. */
const PURGE_BUDGET = 400;

/** Deletes up to `budget` of the user's rows across every data table.
 * Returns how many were deleted; fewer than `budget` means nothing is left.
 *
 * Rows that reference uploaded files name them in `files` so the file goes
 * with the row — Convex storage outlives the document that pointed at it. */
async function purgeUserData(ctx: MutationCtx, userId: Id<'users'>, budget: number) {
  let remaining = budget;
  type PurgeRow = { _id: Id<any>; files?: (Id<'_storage'> | undefined)[] };
  const steps: (() => Promise<PurgeRow[]>)[] = [
    async () => {
      const owned = await ctx.db
        .query('profilePosts')
        .withIndex('by_user_created', (q) => q.eq('userId', userId))
        .take(remaining);
      const rows: PurgeRow[] = [];
      for (const post of owned) {
        const [likes, comments] = await Promise.all([
          ctx.db
            .query('profilePostLikes')
            .withIndex('by_post', (q) => q.eq('postId', post._id))
            .collect(),
          ctx.db
            .query('profilePostComments')
            .withIndex('by_post_created', (q) => q.eq('postId', post._id))
            .collect(),
        ]);
        for (const like of likes) rows.push({ _id: like._id });
        for (const comment of comments) rows.push({ _id: comment._id });
        rows.push({ _id: post._id, files: [post.imageId] });
      }
      return rows;
    },
    async () => {
      const likes = await ctx.db
        .query('profilePostLikes')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining);
      for (const like of likes) {
        const post = await ctx.db.get(like.postId);
        if (post) {
          await ctx.db.patch(post._id, { likeCount: Math.max(0, (post.likeCount ?? 0) - 1) });
        }
      }
      return likes;
    },
    async () => {
      const comments = await ctx.db
        .query('profilePostComments')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining);
      for (const comment of comments) {
        const post = await ctx.db.get(comment.postId);
        if (post) {
          await ctx.db.patch(post._id, {
            commentCount: Math.max(0, (post.commentCount ?? 0) - 1),
          });
        }
      }
      return comments;
    },
    async () => {
      const [received, caused] = await Promise.all([
        ctx.db
          .query('notifications')
          .withIndex('by_recipient_created', (q) => q.eq('recipientId', userId))
          .take(remaining),
        ctx.db
          .query('notifications')
          .withIndex('by_actor', (q) => q.eq('actorId', userId))
          .take(remaining),
      ]);
      return [...new Map([...received, ...caused].map((row) => [row._id, row])).values()];
    },
    async () =>
      (
        await ctx.db
          .query('profiles')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .take(remaining)
      ).map((row) => ({ _id: row._id, files: [row.avatarId, row.bannerId] })),
    async () => {
      const [asOne, asTwo] = await Promise.all([
        ctx.db
          .query('directChats')
          .withIndex('by_user_one_updated', (q) => q.eq('userOneId', userId))
          .take(remaining),
        ctx.db
          .query('directChats')
          .withIndex('by_user_two_updated', (q) => q.eq('userTwoId', userId))
          .take(remaining),
      ]);
      const rows: PurgeRow[] = [];
      for (const chat of [...asOne, ...asTwo]) {
        const messages = await ctx.db
          .query('chatMessages')
          .withIndex('by_chat_created', (q) => q.eq('chatId', chat._id))
          .collect();
        // A message's attachment is deleted with it, so clearing an account
        // never leaves its photos and clips behind in storage.
        for (const message of messages) rows.push({ _id: message._id, files: [message.mediaId] });
        rows.push({ _id: chat._id });
      }
      return rows;
    },
    () =>
      ctx.db
        .query('profileFollows')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('profileFollows')
        .withIndex('by_followee', (q) => q.eq('followeeId', userId))
        .take(remaining),
    async () => {
      const owned = await ctx.db
        .query('profilePhotos')
        .withIndex('by_user_created', (q) => q.eq('userId', userId))
        .take(remaining);
      const rows: PurgeRow[] = [];
      for (const photo of owned) {
        const likes = await ctx.db
          .query('photoLikes')
          .withIndex('by_photo', (q) => q.eq('photoId', photo._id))
          .collect();
        const comments = await ctx.db
          .query('photoComments')
          .withIndex('by_photo_created', (q) => q.eq('photoId', photo._id))
          .collect();
        for (const like of likes) rows.push({ _id: like._id });
        for (const comment of comments) rows.push({ _id: comment._id });
        rows.push({ _id: photo._id, files: [photo.imageId] });
      }
      return rows;
    },
    () =>
      ctx.db
        .query('photoLikes')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('photoComments')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    async () => {
      const owned = await ctx.db
        .query('fitnessGroups')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining);
      const rows: PurgeRow[] = [];
      for (const group of owned) {
        const seats = await ctx.db
          .query('groupMembers')
          .withIndex('by_group', (q) => q.eq('groupId', group._id))
          .collect();
        for (const seat of seats) rows.push({ _id: seat._id });
        rows.push({ _id: group._id });
      }
      return rows;
    },
    () =>
      ctx.db
        .query('groupMembers')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('diaryEntries')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('foodLogHistory')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('cachedFoods')
        .withIndex('by_user_provider', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('customFoods')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('savedMeals')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('recipes')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('searchHistory')
        .withIndex('by_user_query', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('favorites')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('goalConfigs')
        .withIndex('by_user_effective', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('dayTypeMarks')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('trainingScheduleDays')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('trainingScheduleRepeats')
        .withIndex('by_user_weekday', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('activityEntries')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('dayNotes')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('mealCategories')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('fastingStates')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(remaining),
    () =>
      ctx.db
        .query('settings')
        .withIndex('by_user_key', (q) => q.eq('userId', userId))
        .take(remaining),
  ];
  for (const step of steps) {
    if (remaining <= 0) break;
    const rows = await step();
    for (const row of rows) {
      for (const file of row.files ?? []) if (file) await ctx.storage.delete(file);
      await ctx.db.delete(row._id);
    }
    remaining -= rows.length;
  }
  return budget - remaining;
}

/** Settings → Data → "Delete all data". Keeps the account itself. */
export const deleteAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const deleted = await purgeUserData(ctx, userId, PURGE_BUDGET);
    return { done: deleted < PURGE_BUDGET };
  },
});

/** Settings → Account → "Delete account". Erases every row the user owns,
 * then the sessions, linked provider accounts and the user record, so the
 * next sign-in with the same email starts from nothing. */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const deleted = await purgeUserData(ctx, userId, PURGE_BUDGET);
    if (deleted >= PURGE_BUDGET) return { done: false };

    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }

    await ctx.db.delete(userId);
    return { done: true };
  },
});
