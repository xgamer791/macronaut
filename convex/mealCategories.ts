import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';

/** The four built-in meals are constants, not rows: they exist for every
 * account and cannot be deleted. Only user-added meals are stored. */
export const BUILTIN_MEALS = [
  { id: 'breakfast', name: 'Breakfast', position: 0, builtin: true },
  { id: 'lunch', name: 'Lunch', position: 1, builtin: true },
  { id: 'dinner', name: 'Dinner', position: 2, builtin: true },
  { id: 'snacks', name: 'Snacks', position: 3, builtin: true },
] as const;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const custom = await ctx.db
      .query('mealCategories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return [
      ...BUILTIN_MEALS.map((m) => ({ ...m })),
      ...custom.map((c) => ({ id: c.catId, name: c.name, position: c.position, builtin: false })),
    ].sort((a, b) => a.position - b.position);
  },
});

export const add = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Meal name is required');
    const custom = await ctx.db
      .query('mealCategories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const lastBuiltin: number = BUILTIN_MEALS[BUILTIN_MEALS.length - 1].position;
    const position = Math.max(lastBuiltin, ...custom.map((c) => c.position)) + 1;
    const catId = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${position}`;
    await ctx.db.insert('mealCategories', { userId, catId, name: trimmed, position });
    return { id: catId, name: trimmed, position, builtin: false };
  },
});
