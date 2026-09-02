import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { nowIso, publicDoc, requireOwned, requireUserId } from './lib/auth';
import { buildItems, validateCollection } from './lib/collections';
import { collectionItemInputValidator } from './lib/validators';

function toMeal(doc: Doc<'savedMeals'>) {
  const { deleted: _d, ...rest } = publicDoc(doc);
  return rest;
}

export const list = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, { query: q }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('savedMeals')
      .withIndex('by_user', (idx) => idx.eq('userId', userId))
      .collect();
    const needle = q?.trim().toLowerCase();
    return rows
      .filter((r) => !r.deleted)
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toMeal);
  },
});

export const get = query({
  args: { id: v.id('savedMeals') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId || doc.deleted) return null;
    return toMeal(doc);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
    servings: v.number(),
    notes: v.optional(v.string()),
    items: v.array(collectionItemInputValidator),
  },
  handler: async (ctx, input) => {
    const userId = await requireUserId(ctx);
    const name = validateCollection(input.name, input.servings);
    const now = nowIso();
    const doc = {
      userId,
      name,
      imageUrl: input.imageUrl,
      servings: input.servings,
      notes: input.notes,
      favorite: false,
      deleted: false,
      items: buildItems(input.items),
      createdAt: now,
      updatedAt: now,
    };
    const id = await ctx.db.insert('savedMeals', doc);
    return toMeal({ _id: id, _creationTime: Date.now(), ...doc });
  },
});

export const update = mutation({
  args: {
    id: v.id('savedMeals'),
    patch: v.object({
      name: v.optional(v.string()),
      imageUrl: v.optional(v.union(v.string(), v.null())),
      servings: v.optional(v.number()),
      notes: v.optional(v.union(v.string(), v.null())),
      items: v.optional(v.array(collectionItemInputValidator)),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'savedMeals', id, userId);
    if (existing.deleted) throw new Error(`Not found: ${id}`);
    const servings = patch.servings ?? existing.servings;
    const name = validateCollection(patch.name ?? existing.name, servings);
    const next = {
      ...existing,
      name,
      servings,
      imageUrl: patch.imageUrl === undefined ? existing.imageUrl : (patch.imageUrl ?? undefined),
      notes: patch.notes === undefined ? existing.notes : (patch.notes ?? undefined),
      items: patch.items ? buildItems(patch.items) : existing.items,
      updatedAt: nowIso(),
    };
    const { _id, _creationTime: _t, ...fields } = next;
    await ctx.db.replace(_id, fields);
    return toMeal(next);
  },
});

export const remove = mutation({
  args: { id: v.id('savedMeals') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await requireOwned(ctx, 'savedMeals', id, userId);
    await ctx.db.patch(id, { deleted: true, updatedAt: nowIso() });
    return null;
  },
});

export const duplicate = mutation({
  args: { id: v.id('savedMeals') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'savedMeals', id, userId);
    if (existing.deleted) throw new Error(`Not found: ${id}`);
    const now = nowIso();
    const doc = {
      userId,
      name: `${existing.name} (copy)`,
      imageUrl: existing.imageUrl,
      servings: existing.servings,
      notes: existing.notes,
      favorite: false,
      deleted: false,
      items: buildItems(existing.items),
      createdAt: now,
      updatedAt: now,
    };
    const newDocId = await ctx.db.insert('savedMeals', doc);
    return toMeal({ _id: newDocId, _creationTime: Date.now(), ...doc });
  },
});

export const setFavorite = mutation({
  args: { id: v.id('savedMeals'), favorite: v.boolean() },
  handler: async (ctx, { id, favorite }) => {
    const userId = await requireUserId(ctx);
    await requireOwned(ctx, 'savedMeals', id, userId);
    await ctx.db.patch(id, { favorite, updatedAt: nowIso() });
    return null;
  },
});
