import { v } from 'convex/values';
import { mutation, query, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';

/** Recents and frequents are aggregated over the most recent log events
 * rather than the whole table, which keeps the read bounded as history
 * grows; a food last logged more than this many events ago is not "recent". */
const HISTORY_WINDOW = 1000;

export const recordLog = mutation({
  args: {
    foodKey: v.string(),
    name: v.string(),
    meal: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { foodKey, name, meal, imageUrl }) => {
    const userId = await requireUserId(ctx);
    await ctx.db.insert('foodLogHistory', { userId, foodKey, name, meal, imageUrl, loggedAt: nowIso() });
    return null;
  },
});

async function recentWindow(ctx: QueryCtx) {
  const userId = await requireUserId(ctx);
  // Newest first, so the first row seen for a key carries its latest name/image.
  return ctx.db
    .query('foodLogHistory')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .order('desc')
    .take(HISTORY_WINDOW);
}

export const recentFoods = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await recentWindow(ctx);
    const byKey = new Map<string, { foodKey: string; name: string; imageUrl?: string; lastLoggedAt: string }>();
    for (const row of rows) {
      const current = byKey.get(row.foodKey);
      if (!current) {
        byKey.set(row.foodKey, {
          foodKey: row.foodKey,
          name: row.name,
          imageUrl: row.imageUrl,
          lastLoggedAt: row.loggedAt,
        });
      } else if (!current.imageUrl && row.imageUrl) {
        current.imageUrl = row.imageUrl;
      }
    }
    return [...byKey.values()]
      .sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt))
      .slice(0, limit ?? 15);
  },
});

/** Ranked by logging frequency; with `meal`, foods commonly logged in that
 * meal rank first. */
export const frequentFoods = query({
  args: { limit: v.optional(v.number()), meal: v.optional(v.string()) },
  handler: async (ctx, { limit, meal }) => {
    const rows = await recentWindow(ctx);
    const byKey = new Map<
      string,
      { foodKey: string; name: string; imageUrl?: string; count: number; mealCount: number; last: string }
    >();
    for (const row of rows) {
      const current = byKey.get(row.foodKey);
      if (!current) {
        byKey.set(row.foodKey, {
          foodKey: row.foodKey,
          name: row.name,
          imageUrl: row.imageUrl,
          count: 1,
          mealCount: meal && row.meal === meal ? 1 : 0,
          last: row.loggedAt,
        });
      } else {
        current.count += 1;
        if (meal && row.meal === meal) current.mealCount += 1;
        if (!current.imageUrl && row.imageUrl) current.imageUrl = row.imageUrl;
      }
    }
    return [...byKey.values()]
      .sort(
        (a, b) =>
          (meal ? b.mealCount - a.mealCount : 0) ||
          b.count - a.count ||
          b.last.localeCompare(a.last),
      )
      .slice(0, limit ?? 15)
      .map(({ foodKey, name, imageUrl, count }) => ({ foodKey, name, imageUrl, count }));
  },
});

export const recordSearch = mutation({
  args: { query: v.string() },
  handler: async (ctx, { query: raw }) => {
    const userId = await requireUserId(ctx);
    const q = raw.trim();
    if (!q) return null;
    // Re-insert rather than patch: recency is ordered by searchedAt and then
    // creation time, so a repeat search must be newest on both.
    const existing = await ctx.db
      .query('searchHistory')
      .withIndex('by_user_query', (idx) => idx.eq('userId', userId).eq('query', q))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert('searchHistory', { userId, query: q, searchedAt: nowIso() });
    return null;
  },
});

export const recentSearches = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('searchHistory')
      .withIndex('by_user_time', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit ?? 10);
    return rows.map((r) => r.query);
  },
});

export const clearSearches = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('searchHistory')
      .withIndex('by_user_query', (q) => q.eq('userId', userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});
