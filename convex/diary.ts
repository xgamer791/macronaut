import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { nowIso, publicDoc, requireOwned, requireUserId } from './lib/auth';
import { diaryEntryFields, nutritionValidator, sourceTypeValidator } from './lib/validators';

const toEntry = (doc: Doc<'diaryEntries'>) => publicDoc(doc);

const diaryEntryPatch = {
  date: v.optional(v.string()),
  meal: v.optional(v.string()),
  time: v.optional(v.string()),
  name: v.optional(v.string()),
  brand: v.optional(v.string()),
  sourceType: v.optional(sourceTypeValidator),
  sourceId: v.optional(v.string()),
  quantity: v.optional(v.number()),
  unit: v.optional(v.string()),
  servingDesc: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  nutrition: v.optional(nutritionValidator),
  notes: v.optional(v.string()),
};

async function insertEntry(
  ctx: MutationCtx,
  userId: Id<'users'>,
  entry: Omit<Doc<'diaryEntries'>, '_id' | '_creationTime' | 'userId' | 'createdAt' | 'updatedAt'>,
) {
  const now = nowIso();
  const doc = { userId, createdAt: now, updatedAt: now, ...entry };
  const id = await ctx.db.insert('diaryEntries', doc);
  return toEntry({ _id: id, _creationTime: Date.now(), ...doc });
}

function copyable(doc: Doc<'diaryEntries'>) {
  const { _id, _creationTime: _t, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = doc;
  return rest;
}

async function entriesFor(ctx: MutationCtx, userId: Id<'users'>, date: string) {
  return ctx.db
    .query('diaryEntries')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();
}

export const entriesForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('diaryEntries')
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
      .query('diaryEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .collect();
    return rows.map(toEntry);
  },
});

export const add = mutation({
  args: diaryEntryFields,
  handler: async (ctx, entry) => {
    const userId = await requireUserId(ctx);
    return insertEntry(ctx, userId, entry);
  },
});

export const update = mutation({
  args: { id: v.id('diaryEntries'), patch: v.object(diaryEntryPatch) },
  handler: async (ctx, { id, patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'diaryEntries', id, userId);
    const merged = { ...existing, ...patch, updatedAt: nowIso() };
    const { _id, _creationTime: _t, ...fields } = merged;
    await ctx.db.replace(_id, fields);
    return toEntry(merged);
  },
});

export const remove = mutation({
  args: { id: v.id('diaryEntries') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) await ctx.db.delete(id);
    return null;
  },
});

export const removeMany = mutation({
  args: { ids: v.array(v.id('diaryEntries')) },
  handler: async (ctx, { ids }) => {
    const userId = await requireUserId(ctx);
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (doc && doc.userId === userId) await ctx.db.delete(id);
    }
    return null;
  },
});

export const duplicate = mutation({
  args: { id: v.id('diaryEntries') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'diaryEntries', id, userId);
    return insertEntry(ctx, userId, copyable(existing));
  },
});

export const move = mutation({
  args: { id: v.id('diaryEntries'), meal: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { id, meal, date }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'diaryEntries', id, userId);
    const merged = { ...existing, meal, date: date ?? existing.date, updatedAt: nowIso() };
    await ctx.db.patch(id, { meal: merged.meal, date: merged.date, updatedAt: merged.updatedAt });
    return toEntry(merged);
  },
});

export const moveMany = mutation({
  args: { ids: v.array(v.id('diaryEntries')), meal: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { ids, meal, date }) => {
    const userId = await requireUserId(ctx);
    for (const id of ids) {
      const existing = await requireOwned(ctx, 'diaryEntries', id, userId);
      await ctx.db.patch(id, { meal, date: date ?? existing.date, updatedAt: nowIso() });
    }
    return null;
  },
});

/** Copy all entries of a meal to another date (same meal). Returns the count. */
export const copyMeal = mutation({
  args: { fromDate: v.string(), meal: v.string(), toDate: v.string() },
  handler: async (ctx, { fromDate, meal, toDate }) => {
    const userId = await requireUserId(ctx);
    const rows = (await entriesFor(ctx, userId, fromDate)).filter((r) => r.meal === meal);
    for (const row of rows) await insertEntry(ctx, userId, { ...copyable(row), date: toDate });
    return rows.length;
  },
});

/** Copy an entire day's entries to another date. Returns the count. */
export const copyDay = mutation({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, { fromDate, toDate }) => {
    const userId = await requireUserId(ctx);
    const rows = await entriesFor(ctx, userId, fromDate);
    for (const row of rows) await insertEntry(ctx, userId, { ...copyable(row), date: toDate });
    return rows.length;
  },
});

export const clearMeal = mutation({
  args: { date: v.string(), meal: v.string() },
  handler: async (ctx, { date, meal }) => {
    const userId = await requireUserId(ctx);
    const rows = (await entriesFor(ctx, userId, date)).filter((r) => r.meal === meal);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});
