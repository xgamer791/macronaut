import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { nowIso, publicDoc, requireOwned, requireUserId } from './lib/auth';
import {
  activityEntryFields,
  activityIntensityValidator,
  activitySourceValidator,
  activityTypeValidator,
} from './lib/validators';

function toEntry(doc: Doc<'activityEntries'>) {
  const { nameLower: _n, ...rest } = publicDoc(doc);
  return rest;
}

const activityPatch = {
  date: v.optional(v.string()),
  name: v.optional(v.string()),
  activityType: v.optional(activityTypeValidator),
  durationMin: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  caloriesBurned: v.optional(v.number()),
  intensity: v.optional(activityIntensityValidator),
  notes: v.optional(v.string()),
  sourceType: v.optional(activitySourceValidator),
  sourceId: v.optional(v.string()),
};

export const entriesForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('activityEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .collect();
    return rows.map(toEntry);
  },
});

export const entriesForRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('activityEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .collect();
    return rows.map(toEntry);
  },
});

export const get = query({
  args: { id: v.id('activityEntries') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    return doc && doc.userId === userId ? toEntry(doc) : null;
  },
});

export const add = mutation({
  args: activityEntryFields,
  handler: async (ctx, entry) => {
    const userId = await requireUserId(ctx);
    const now = nowIso();
    const doc = {
      userId,
      nameLower: entry.name.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
      ...entry,
    };
    const id = await ctx.db.insert('activityEntries', doc);
    return toEntry({ _id: id, _creationTime: Date.now(), ...doc });
  },
});

export const update = mutation({
  args: { id: v.id('activityEntries'), patch: v.object(activityPatch) },
  handler: async (ctx, { id, patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'activityEntries', id, userId);
    const next = { ...existing, ...patch, updatedAt: nowIso() };
    next.nameLower = next.name.trim().toLowerCase();
    const { _id, _creationTime: _t, ...fields } = next;
    await ctx.db.replace(_id, fields);
    return toEntry(next);
  },
});

export const remove = mutation({
  args: { id: v.id('activityEntries') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) await ctx.db.delete(id);
    return null;
  },
});

/** Prior sessions of the same name (most recent first), for PR chips. */
export const previousByName = query({
  args: { name: v.string(), beforeDate: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { name, beforeDate, limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('activityEntries')
      .withIndex('by_user_name_date', (q) =>
        q.eq('userId', userId).eq('nameLower', name.trim().toLowerCase()).lt('date', beforeDate),
      )
      .order('desc')
      .take(limit ?? 5);
    return rows.map(toEntry);
  },
});

export const totalBurnedForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('activityEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .collect();
    return rows.reduce((sum, r) => sum + r.caloriesBurned, 0);
  },
});
