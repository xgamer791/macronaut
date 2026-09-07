import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { newId, nowIso, publicDoc, requireUserId } from './lib/auth';
import { scheduledWorkoutValidator } from './lib/validators';

const MAX_WORKOUTS_PER_DAY = 24;
const MAX_DAY_LABEL = 64;
const MAX_WORKOUT_LABEL = 80;
const MAX_MACRO_LABEL = 48;
const MAX_NOTES = 600;
const MAX_RANGE_DAYS = 32;

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

function weekdayOf(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let date = from;
  while (date <= to && dates.length <= MAX_RANGE_DAYS) {
    dates.push(date);
    date = addDay(date);
  }
  if (dates.length > MAX_RANGE_DAYS || dates.at(-1) !== to) {
    throw new ConvexError(`Load up to ${MAX_RANGE_DAYS} training days at a time`);
  }
  return dates;
}

function dayView(row: Doc<'trainingScheduleDays'>) {
  return publicDoc(row);
}

function repeatedDayView(row: Doc<'trainingScheduleRepeats'>, date: string) {
  return {
    id: `repeat:${row._id}:${date}`,
    date,
    label: row.label as string,
    ...(row.notes ? { notes: row.notes } : {}),
    workouts: row.workouts as Doc<'trainingScheduleDays'>['workouts'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    repeatedFrom: row.sourceDate,
  };
}

async function writeRepeatRule(
  ctx: MutationCtx,
  userId: Id<'users'>,
  weekday: number,
  enabled: boolean,
  source?: Doc<'trainingScheduleDays'>,
) {
  const existing = await ctx.db
    .query('trainingScheduleRepeats')
    .withIndex('by_user_weekday', (q) => q.eq('userId', userId).eq('weekday', weekday))
    .first();
  const updatedAt = nowIso();
  const template = source
    ? {
        sourceDate: source.date,
        label: source.label,
        ...(source.notes ? { notes: source.notes } : {}),
        workouts: source.workouts,
      }
    : existing?.sourceDate && existing.label && existing.workouts
      ? {
          sourceDate: existing.sourceDate,
          label: existing.label,
          ...(existing.notes ? { notes: existing.notes } : {}),
          workouts: existing.workouts,
        }
      : {};
  const fields = {
    userId,
    weekday,
    enabled,
    ...template,
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
  };

  if (existing) await ctx.db.replace(existing._id, fields);
  else await ctx.db.insert('trainingScheduleRepeats', fields);
}

async function enabledWeekdays(ctx: MutationCtx, userId: Id<'users'>): Promise<number[]> {
  const rows = await ctx.db
    .query('trainingScheduleRepeats')
    .withIndex('by_user_weekday', (q) => q.eq('userId', userId))
    .take(7);
  return rows
    .filter((row) => row.enabled)
    .map((row) => row.weekday)
    .sort((a, b) => a - b);
}

/** A bounded date range keeps the weekly screen quick while still leaving
 * room for future multi-week views. Exact plans win over recurring templates. */
export const range = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    if (!isDayKey(from) || !isDayKey(to) || from > to) {
      throw new ConvexError('Choose a valid schedule range');
    }
    const dates = datesInRange(from, to);
    const [rows, repeats] = await Promise.all([
      ctx.db
        .query('trainingScheduleDays')
        .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
        .take(MAX_RANGE_DAYS),
      ctx.db
        .query('trainingScheduleRepeats')
        .withIndex('by_user_weekday', (q) => q.eq('userId', userId))
        .take(7),
    ]);
    const exactByDate = new Map(rows.map((row) => [row.date, row]));
    const repeatByWeekday = new Map(repeats.map((row) => [row.weekday, row]));

    return dates.flatMap((date) => {
      const exact = exactByDate.get(date);
      if (exact) return [dayView(exact)];
      const repeat = repeatByWeekday.get(weekdayOf(date));
      if (
        !repeat?.enabled ||
        !repeat.sourceDate ||
        repeat.sourceDate > date ||
        !repeat.label ||
        !repeat.workouts
      ) {
        return [];
      }
      return [repeatedDayView(repeat, date)];
    });
  },
});

export const repeatDays = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query('trainingScheduleRepeats')
      .withIndex('by_user_weekday', (q) => q.eq('userId', userId))
      .take(7);
    return rows
      .filter((row) => row.enabled)
      .map((row) => row.weekday)
      .sort((a, b) => a - b);
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
    let saved: Doc<'trainingScheduleDays'>;

    if (existing) {
      saved = { ...existing, label, notes, workouts, updatedAt };
      const { _id, _creationTime: _time, ...fields } = saved;
      await ctx.db.replace(_id, fields);
    } else {
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
      saved = { _id: id, _creationTime: Date.now(), ...row };
    }

    const weekday = weekdayOf(input.date);
    const repeat = await ctx.db
      .query('trainingScheduleRepeats')
      .withIndex('by_user_weekday', (q) => q.eq('userId', userId).eq('weekday', weekday))
      .first();
    if (repeat?.enabled) await writeRepeatRule(ctx, userId, weekday, true, saved);
    return dayView(saved);
  },
});

export const setRepeatDay = mutation({
  args: { date: v.string(), enabled: v.boolean() },
  handler: async (ctx, { date, enabled }) => {
    const userId = await requireUserId(ctx);
    if (!isDayKey(date)) throw new ConvexError('Choose a valid training day');
    const source = await ctx.db
      .query('trainingScheduleDays')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .first();
    await writeRepeatRule(ctx, userId, weekdayOf(date), enabled, source ?? undefined);
    return enabledWeekdays(ctx, userId);
  },
});

export const setRepeatAll = mutation({
  args: { dates: v.array(v.string()), enabled: v.boolean() },
  handler: async (ctx, { dates, enabled }) => {
    const userId = await requireUserId(ctx);
    const weekdays = dates.map((date) => {
      if (!isDayKey(date)) throw new ConvexError('Choose valid training days');
      return weekdayOf(date);
    });
    if (dates.length !== 7 || new Set(weekdays).size !== 7) {
      throw new ConvexError('Choose one full week');
    }

    for (let index = 0; index < dates.length; index += 1) {
      const date = dates[index];
      const source = enabled
        ? await ctx.db
            .query('trainingScheduleDays')
            .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
            .first()
        : null;
      await writeRepeatRule(ctx, userId, weekdays[index], enabled, source ?? undefined);
    }
    return enabledWeekdays(ctx, userId);
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

    const weekday = weekdayOf(date);
    const repeat = await ctx.db
      .query('trainingScheduleRepeats')
      .withIndex('by_user_weekday', (q) => q.eq('userId', userId).eq('weekday', weekday))
      .first();
    if (repeat?.enabled) await writeRepeatRule(ctx, userId, weekday, false);
    return null;
  },
});
