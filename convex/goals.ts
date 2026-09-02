import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { dayTypeValidator, goalConfigFields } from './lib/validators';

function toConfig(doc: Doc<'goalConfigs'>) {
  const { _id, _creationTime: _t, userId: _u, createdAt: _c, ...rest } = doc;
  return { id: _id, ...rest };
}

/** Every effective-dated version, oldest first. */
export const listConfigs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('goalConfigs')
      .withIndex('by_user_effective', (q) => q.eq('userId', userId))
      .collect();
    return rows.map(toConfig);
  },
});

/** Save a new effective-dated version. A same-day re-edit replaces that
 * day's version instead of stacking. */
export const saveConfig = mutation({
  args: goalConfigFields,
  handler: async (ctx, config) => {
    const userId = await requireUserId(ctx);
    const sameDay = await ctx.db
      .query('goalConfigs')
      .withIndex('by_user_effective', (q) =>
        q.eq('userId', userId).eq('effectiveFrom', config.effectiveFrom),
      )
      .collect();
    for (const row of sameDay) await ctx.db.delete(row._id);
    const id = await ctx.db.insert('goalConfigs', { userId, createdAt: nowIso(), ...config });
    return { id, ...config };
  },
});

export const getMarks = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('dayTypeMarks')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .collect();
    return Object.fromEntries(rows.map((r) => [r.date, r.dayType]));
  },
});

export const allMarks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('dayTypeMarks')
      .withIndex('by_user_date', (q) => q.eq('userId', userId))
      .collect();
    return Object.fromEntries(rows.map((r) => [r.date, r.dayType]));
  },
});

export const setMark = mutation({
  args: { date: v.string(), dayType: v.union(dayTypeValidator, v.null()) },
  handler: async (ctx, { date, dayType }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query('dayTypeMarks')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .collect();
    if (dayType === null) {
      for (const row of existing) await ctx.db.delete(row._id);
      return null;
    }
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, { dayType });
      for (const dup of existing.slice(1)) await ctx.db.delete(dup._id);
    } else {
      await ctx.db.insert('dayTypeMarks', { userId, date, dayType });
    }
    return null;
  },
});
