import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { nowIso, publicDoc, requireOwned, requireUserId } from './lib/auth';
import { cachedFoodFields, customFoodFields, nutritionValidator } from './lib/validators';

// ---------------------------------------------------------------------------
// Custom foods

function toCustom(doc: Doc<'customFoods'>) {
  const { deleted: _d, ...rest } = publicDoc(doc);
  return rest;
}

function validateCustom(food: { name: string; nutrition: { calories: number } }) {
  if (!food.name.trim()) throw new Error('Food name is required');
  if (food.nutrition.calories < 0) throw new Error('Calories cannot be negative');
}

const customFoodPatch = {
  name: v.optional(v.string()),
  brand: v.optional(v.string()),
  barcode: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  servingQty: v.optional(v.number()),
  servingUnit: v.optional(v.string()),
  gramsPerServing: v.optional(v.number()),
  nutrition: v.optional(nutritionValidator),
  notes: v.optional(v.string()),
  favorite: v.optional(v.boolean()),
  sourceProvider: v.optional(v.string()),
  sourceId: v.optional(v.string()),
};

export const listCustom = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, { query: q }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('customFoods')
      .withIndex('by_user', (idx) => idx.eq('userId', userId))
      .collect();
    const needle = q?.trim().toLowerCase();
    return rows
      .filter((r) => !r.deleted)
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          (r.brand ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toCustom);
  },
});

export const getCustom = query({
  args: { id: v.id('customFoods') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId || doc.deleted) return null;
    return toCustom(doc);
  },
});

export const addCustom = mutation({
  args: customFoodFields,
  handler: async (ctx, food) => {
    const userId = await requireUserId(ctx);
    validateCustom(food);
    const now = nowIso();
    const doc = {
      userId,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      ...food,
      name: food.name.trim(),
    };
    const id = await ctx.db.insert('customFoods', doc);
    return toCustom({ _id: id, _creationTime: Date.now(), ...doc });
  },
});

export const updateCustom = mutation({
  args: { id: v.id('customFoods'), patch: v.object(customFoodPatch) },
  handler: async (ctx, { id, patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'customFoods', id, userId);
    if (existing.deleted) throw new Error(`Custom food not found: ${id}`);
    const merged = { ...existing, ...patch, updatedAt: nowIso() };
    validateCustom(merged);
    merged.name = merged.name.trim();
    const { _id, _creationTime: _t, ...fields } = merged;
    await ctx.db.replace(_id, fields);
    return toCustom(merged);
  },
});

export const deleteCustom = mutation({
  args: { id: v.id('customFoods') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await requireOwned(ctx, 'customFoods', id, userId);
    await ctx.db.patch(id, { deleted: true, updatedAt: nowIso() });
    return null;
  },
});

export const duplicateCustom = mutation({
  args: { id: v.id('customFoods') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'customFoods', id, userId);
    if (existing.deleted) throw new Error(`Custom food not found: ${id}`);
    const { _id, _creationTime: _t, createdAt: _c, updatedAt: _u, ...rest } = existing;
    const now = nowIso();
    const doc = {
      ...rest,
      name: `${existing.name} (copy)`,
      favorite: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    const newDocId = await ctx.db.insert('customFoods', doc);
    return toCustom({ _id: newDocId, _creationTime: Date.now(), ...doc });
  },
});

export const setCustomFavorite = mutation({
  args: { id: v.id('customFoods'), favorite: v.boolean() },
  handler: async (ctx, { id, favorite }) => {
    const userId = await requireUserId(ctx);
    await requireOwned(ctx, 'customFoods', id, userId);
    await ctx.db.patch(id, { favorite, updatedAt: nowIso() });
    return null;
  },
});

export const findCustomByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, { barcode }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('customFoods')
      .withIndex('by_user_barcode', (q) => q.eq('userId', userId).eq('barcode', barcode))
      .collect();
    const live = rows.filter((r) => !r.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return live[0] ? toCustom(live[0]) : null;
  },
});

// ---------------------------------------------------------------------------
// Cached provider foods

function toCached(doc: Doc<'cachedFoods'>) {
  const { searchText: _s, id: _id, ...rest } = publicDoc(doc);
  return { ...rest, verified: rest.verified ?? false, corrected: rest.corrected ?? false };
}

function searchTextFor(food: { name: string; brand?: string; restaurant?: string }): string {
  return [food.name, food.brand, food.restaurant]
    .filter((s): s is string => Boolean(s))
    .join(' ')
    .toLowerCase();
}

/** Insert or refresh cached provider records. A record the user has
 * corrected is never overwritten by fresh provider data, and a user's
 * `flagged` mark survives refreshes. */
export const upsertCachedMany = mutation({
  args: { foods: v.array(v.object(cachedFoodFields)) },
  handler: async (ctx, { foods }) => {
    const userId = await requireUserId(ctx);
    for (const food of foods) {
      const existing = await ctx.db
        .query('cachedFoods')
        .withIndex('by_user_provider', (q) =>
          q.eq('userId', userId).eq('provider', food.provider).eq('providerId', food.providerId),
        )
        .first();
      const searchText = searchTextFor(food);
      if (!existing) {
        await ctx.db.insert('cachedFoods', { userId, searchText, ...food });
        continue;
      }
      if (existing.corrected) continue;
      const { flagged: _f, corrected: _c, ...refresh } = food;
      await ctx.db.replace(existing._id, {
        userId,
        searchText,
        ...refresh,
        flagged: existing.flagged,
        corrected: existing.corrected ?? false,
      });
    }
    return null;
  },
});

export const getCached = query({
  args: { provider: v.string(), providerId: v.string() },
  handler: async (ctx, { provider, providerId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('cachedFoods')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider).eq('providerId', providerId),
      )
      .first();
    return row ? toCached(row) : null;
  },
});

export const findCachedByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, { barcode }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('cachedFoods')
      .withIndex('by_user_barcode', (q) => q.eq('userId', userId).eq('barcode', barcode))
      .collect();
    rows.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
    return rows[0] ? toCached(rows[0]) : null;
  },
});

export const searchCached = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query: q, limit }) => {
    const userId = await requireUserId(ctx);
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const rows = await ctx.db
      .query('cachedFoods')
      .withSearchIndex('search_text', (s) => s.search('searchText', needle).eq('userId', userId))
      .take(Math.max(1, Math.min(limit ?? 25, 100)));
    return rows.map(toCached);
  },
});

export const setFlagged = mutation({
  args: { provider: v.string(), providerId: v.string(), flagged: v.boolean() },
  handler: async (ctx, { provider, providerId, flagged }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('cachedFoods')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider).eq('providerId', providerId),
      )
      .first();
    if (row) await ctx.db.patch(row._id, { flagged });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Provider-food favorites (custom foods carry their own flag)

export const isFavorite = query({
  args: { foodKey: v.string() },
  handler: async (ctx, { foodKey }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('favorites')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
      .first();
    return row !== null;
  },
});

export const setFavorite = mutation({
  args: { foodKey: v.string(), favorite: v.boolean() },
  handler: async (ctx, { foodKey, favorite }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('favorites')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('foodKey', foodKey))
      .collect();
    if (favorite) {
      if (rows.length === 0) await ctx.db.insert('favorites', { userId, foodKey, createdAt: nowIso() });
    } else {
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const listFavoriteKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('favorites')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return rows.map((r) => r.foodKey);
  },
});
