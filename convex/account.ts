import { getAuthUserId } from '@convex-dev/auth/server';
import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { requireUserId } from './lib/auth';

export type AuthProviderId = 'google' | 'email';

/** The signed-in user as the app shows it. Provider metadata (Google's
 * `name`) is user-controlled text; it is capped here and again where shown. */
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
    const provider: AuthProviderId | undefined = providers.has('google')
      ? 'google'
      : providers.has('resend-otp')
        ? 'email'
        : undefined;
    return {
      id: userId,
      email: user.email,
      name: user.name?.trim().slice(0, 60) || undefined,
      image: user.image,
      provider,
    };
  },
});

/** Rows deleted per call. Convex bounds the work one mutation may do, so a
 * large diary is erased over several calls; the client repeats until `done`. */
const PURGE_BUDGET = 400;

/** Deletes up to `budget` of the user's rows across every data table.
 * Returns how many were deleted; fewer than `budget` means nothing is left. */
async function purgeUserData(ctx: MutationCtx, userId: Id<'users'>, budget: number) {
  let remaining = budget;
  const steps: (() => Promise<{ _id: Id<any> }[]>)[] = [
    () => ctx.db.query('diaryEntries').withIndex('by_user_date', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('foodLogHistory').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('cachedFoods').withIndex('by_user_provider', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('customFoods').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('savedMeals').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('recipes').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('searchHistory').withIndex('by_user_query', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('favorites').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('goalConfigs').withIndex('by_user_effective', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('dayTypeMarks').withIndex('by_user_date', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('activityEntries').withIndex('by_user_date', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('dayNotes').withIndex('by_user_date', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('mealCategories').withIndex('by_user', (q) => q.eq('userId', userId)).take(remaining),
    () => ctx.db.query('settings').withIndex('by_user_key', (q) => q.eq('userId', userId)).take(remaining),
  ];
  for (const step of steps) {
    if (remaining <= 0) break;
    const rows = await step();
    for (const row of rows) await ctx.db.delete(row._id);
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
