import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { newId, nowIso, publicDoc, requireUserId } from './lib/auth';
import { scheduledWorkoutValidator } from './lib/validators';

const MAX_WORKOUTS_PER_DAY = 24;
const MAX_DAY_LABEL = 64;
const MAX_WORKOUT_LABEL = 80;
const MAX_MACRO_LABEL = 48;
const MAX_NOTES = 600;

function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function dayView(row: Doc<'trainingScheduleDays'>) {
  return publicDoc(row);
}

/** A bounded date range keeps the weekly screen quick while still leaving
 * room for future multi-week views. */
export const range = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    if (!isDayKey(from) || !isDayKey(to) || from > to) {
      throw new ConvexError('Choose a valid schedule range');
    }
    const rows = await ctx.db
      .query('trainingScheduleDays')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .take(32);
    return rows.map(dayView);
  },
});

export const save = mutation({
  args: {
    date: v.string(),
    label: v.string(),
    notes: v.optional(v.string()),
    workouts: v.array(scheduledWorkoutValidator),
  },
  handler: async (ctx, input) => {
    const userId = await requireUserId(ctx);
    if (!isDayKey(input.date)) throw new ConvexError('Choose a valid training day');

    const label = input.label.trim().slice(0, MAX_DAY_LABEL);
    if (!label) throw new ConvexError('Give this day a label');
    if (input.workouts.length > MAX_WORKOUTS_PER_DAY) {
      throw new ConvexError(`Add up to ${MAX_WORKOUTS_PER_DAY} workouts per day`);
    }

    const usedIds = new Set<string>();
    const workouts = input.workouts.map((workout) => {
      const workoutLabel = workout.label.trim().slice(0, MAX_WORKOUT_LABEL);
      if (!workoutLabel) throw new ConvexError('Every workout needs a label');
      if (
        workout.sets !== undefined &&
        (!Number.isInteger(workout.sets) || workout.sets < 1 || workout.sets > 999)
      ) {
        throw new ConvexError('Sets or rounds must be a whole number from 1 to 999');
      }
      let id = workout.id.trim().slice(0, 64);
      if (!id || usedIds.has(id)) id = newId();
      usedIds.add(id);
      const macroLabel = workout.macroLabel?.trim().slice(0, MAX_MACRO_LABEL) || undefined;
      return { id, label: workoutLabel, macroLabel, sets: workout.sets };
    });
    const notes = input.notes?.trim().slice(0, MAX_NOTES) || undefined;
    const existing = await ctx.db
      .query('trainingScheduleDays')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', input.date))
      .first();
    const updatedAt = nowIso();

    if (existing) {
      const next = { ...existing, label, notes, workouts, updatedAt };
      const { _id, _creationTime: _time, ...fields } = next;
      await ctx.db.replace(_id, fields);
      return dayView(next);
    }

    const row = {
      userId,
      date: input.date,
      label,
      notes,
      workouts,
      createdAt: updatedAt,
      updatedAt,
    };
    const id = await ctx.db.insert('trainingScheduleDays', row);
    return dayView({ _id: id, _creationTime: Date.now(), ...row });
  },
});

export const remove = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    if (!isDayKey(date)) throw new ConvexError('Choose a valid training day');
    const row = await ctx.db
      .query('trainingScheduleDays')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .first();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});
