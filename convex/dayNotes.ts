import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { nowIso, publicDoc, requireOwned, requireUserId } from './lib/auth';

const toNote = (doc: Doc<'dayNotes'>) => publicDoc(doc);

export const listForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('dayNotes')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .collect();
    return rows.map(toNote);
  },
});

export const add = mutation({
  args: { date: v.string(), body: v.string() },
  handler: async (ctx, { date, body }) => {
    const userId = await requireUserId(ctx);
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Note cannot be empty');
    const ts = nowIso();
    const doc = { userId, date, body: trimmed, createdAt: ts, updatedAt: ts };
    const id = await ctx.db.insert('dayNotes', doc);
    return toNote({ _id: id, _creationTime: Date.now(), ...doc });
  },
});

export const update = mutation({
  args: { id: v.id('dayNotes'), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Note cannot be empty');
    const existing = await requireOwned(ctx, 'dayNotes', id, userId);
    const next = { ...existing, body: trimmed, updatedAt: nowIso() };
    await ctx.db.patch(id, { body: next.body, updatedAt: next.updatedAt });
    return toNote(next);
  },
});

export const remove = mutation({
  args: { id: v.id('dayNotes') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) await ctx.db.delete(id);
    return null;
  },
});

/** Distinct dates in the range that have at least one non-empty note. */
export const datesWithNotes = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('dayNotes')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .collect();
    const dates = new Set<string>();
    for (const row of rows) if (row.body.trim()) dates.add(row.date);
    return [...dates].sort();
  },
});
