import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';

/** Values are JSON text: the app encodes and decodes them, exactly as it did
 * with the previous local database, so any shape can be stored under any key
 * without a schema change. */

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('settings')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', key))
      .first();
    return row?.value ?? null;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('settings')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', key))
      .first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert('settings', { userId, key, value });
    return null;
  },
});
