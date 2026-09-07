import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { newId, nowIso, requireUserId } from './lib/auth';

const MAX_CUSTOM_SLOTS = 10;
const MAX_LABEL_LENGTH = 36;

function validTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validDuration(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export const state = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('fastingStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    return {
      activeStartAt: row?.activeStartAt ?? null,
      activeEndAt: row?.activeEndAt ?? null,
      customSlots: row?.customSlots ?? [],
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

export const start = mutation({
  args: { startAt: v.number(), endAt: v.number() },
  handler: async (ctx, { startAt, endAt }) => {
    const userId = await requireUserId(ctx);
    if (!validTimestamp(startAt) || !validTimestamp(endAt) || endAt <= startAt) {
      throw new Error('The fast must end after it starts');
    }
    const row = await ctx.db
      .query('fastingStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const updatedAt = nowIso();
    if (row) {
      await ctx.db.patch(row._id, { activeStartAt: startAt, activeEndAt: endAt, updatedAt });
    } else {
      await ctx.db.insert('fastingStates', {
        userId,
        activeStartAt: startAt,
        activeEndAt: endAt,
        customSlots: [],
        updatedAt,
      });
    }
    return { activeStartAt: startAt, activeEndAt: endAt, updatedAt };
  },
});

export const stop = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('fastingStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (row) {
      await ctx.db.patch(row._id, {
        activeStartAt: undefined,
        activeEndAt: undefined,
        updatedAt: nowIso(),
      });
    }
    return null;
  },
});

export const saveSlot = mutation({
  args: { label: v.string(), durationMinutes: v.number() },
  handler: async (ctx, { label, durationMinutes }) => {
    const userId = await requireUserId(ctx);
    const cleanLabel = label.trim().slice(0, MAX_LABEL_LENGTH);
    if (!cleanLabel) throw new Error('Give this fasting time a name');
    if (!validDuration(durationMinutes)) throw new Error('Fasting time must be longer than zero');

    const row = await ctx.db
      .query('fastingStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const existing = row?.customSlots ?? [];
    if (existing.length >= MAX_CUSTOM_SLOTS) {
      throw new Error(`You can save up to ${MAX_CUSTOM_SLOTS} custom fasting times`);
    }

    const slot = {
      id: newId(),
      label: cleanLabel,
      durationMinutes,
    };
    const customSlots = [...existing, slot];
    const updatedAt = nowIso();
    if (row) {
      await ctx.db.patch(row._id, { customSlots, updatedAt });
    } else {
      await ctx.db.insert('fastingStates', { userId, customSlots, updatedAt });
    }
    return slot;
  },
});

export const removeSlot = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query('fastingStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!row) return null;
    const customSlots = row.customSlots.filter((slot) => slot.id !== id);
    if (customSlots.length !== row.customSlots.length) {
      await ctx.db.patch(row._id, { customSlots, updatedAt: nowIso() });
    }
    return null;
  },
});
