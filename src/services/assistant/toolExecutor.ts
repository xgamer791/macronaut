import { dayProgress } from '@/domain/aggregation';
import type { Repos } from '@/state/AppProvider';
import { addDays, todayKey, type DayKey } from '@/utils/date';
import { fingerprintToolCall } from './agentPolicy';
import { tryResolveDayKey } from './dateResolve';
import {
  findRecentMutation,
  forgetFact,
  loadAssistantMemory,
  pinFact,
  popUndo,
  pushUndo,
  recallFriendly,
  rememberMutation,
  saveAssistantMemory,
  type AssistantMemoryStore,
} from './memory';

export type ToolInvalidate =
  | { kind: 'diary'; date?: DayKey }
  | { kind: 'activity'; date?: DayKey }
  | { kind: 'notes'; date?: DayKey }
  | { kind: 'memory' };

export interface ToolExecContext {
  repos: Repos;
  selectedDate: DayKey;
  targetMeal: string;
  memory: AssistantMemoryStore;
  onMemoryChange: (next: AssistantMemoryStore) => void;
  /** Per voice-turn id for logging / future idempotency. */
  turnId?: string;
}

export interface ToolExecResult {
  ok: boolean;
  data: unknown;
  invalidates: ToolInvalidate[];
  /** When set, the agent should speak this as the final answer (clarify / ask). */
  speakNow?: string;
}

function roundNut(n: number | undefined): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Math.round(n * 10) / 10;
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fail(error: string, extra?: Record<string, unknown>): ToolExecResult {
  return { ok: false, data: { error, ...extra }, invalidates: [] };
}

function resolveDate(
  raw: unknown,
  selectedDate: DayKey,
): { ok: true; date: DayKey } | { ok: false; result: ToolExecResult } {
  const r = tryResolveDayKey(typeof raw === 'string' ? raw : undefined, selectedDate);
  if (!r.ok) return { ok: false, result: fail(r.error) };
  return { ok: true, date: r.date };
}

function commitMemory(ctx: ToolExecContext, next: AssistantMemoryStore) {
  ctx.onMemoryChange(next);
  void saveAssistantMemory(ctx.repos.settings, next);
}

function idempotentGuard(
  ctx: ToolExecContext,
  name: string,
  args: Record<string, unknown>,
): ToolExecResult | null {
  const fp = fingerprintToolCall(name, args);
  const cached = findRecentMutation(ctx.memory, fp);
  if (!cached) return null;
  return {
    ok: true,
    data: {
      deduped: true,
      message: cached,
      note: 'Same action was already applied moments ago — not repeating it.',
    },
    invalidates: [],
  };
}

function markMutation(
  ctx: ToolExecContext,
  name: string,
  args: Record<string, unknown>,
  summary: string,
  nextMem: AssistantMemoryStore,
) {
  const fp = fingerprintToolCall(name, args);
  const withMut = rememberMutation(nextMem, fp, summary);
  commitMemory(ctx, withMut);
}

export async function executeAssistantTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const { repos } = ctx;

  try {
    switch (name) {
      case 'ask_user': {
        const question = String(rawArgs.question ?? '').trim();
        if (!question) return fail('question required');
        return {
          ok: true,
          data: { clarifying: true, question },
          invalidates: [],
          speakNow: question,
        };
      }

      case 'get_day_summary': {
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const date = d.date;
        const entries = await repos.diary.entriesForDate(date);
        const burned = await repos.activity.totalBurnedForDate(date);
        const config = await repos.goals.configFor(date);
        const marks = await repos.goals.getMarks(date, date);
        if (!config) {
          return {
            ok: true,
            data: { date, error: 'No goals set yet', foods: entries.length, burned },
            invalidates: [],
          };
        }
        const progress = dayProgress(
          date,
          entries.map((e) => e.nutrition),
          config,
          marks,
          burned,
        );
        return {
          ok: true,
          data: {
            date,
            calories: Math.round(progress.consumed.calories),
            protein: Math.round(progress.consumed.protein ?? 0),
            carbs: Math.round(progress.consumed.carbs ?? 0),
            fat: Math.round(progress.consumed.fat ?? 0),
            burned: Math.round(progress.burned),
            remaining: Math.round(progress.caloriesRemaining),
            over: progress.overCalories,
            targetCalories: Math.round(progress.target.calories),
            targetProtein: Math.round(progress.target.protein ?? 0),
            foodsLogged: entries.length,
          },
          invalidates: [],
        };
      }

      case 'list_diary_entries': {
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const entries = await repos.diary.entriesForDate(d.date);
        return {
          ok: true,
          data: {
            date: d.date,
            entries: entries.map((e) => ({
              id: e.id,
              meal: e.meal,
              name: e.name,
              calories: Math.round(e.nutrition.calories),
              protein: roundNut(e.nutrition.protein),
              carbs: roundNut(e.nutrition.carbs),
              fat: roundNut(e.nutrition.fat),
              notes: e.notes,
            })),
          },
          invalidates: [],
        };
      }

      case 'find_diary_entries': {
        const query = String(rawArgs.query ?? '').trim().toLowerCase();
        if (!query) return fail('query required');
        const mealFilter = typeof rawArgs.meal === 'string' ? rawArgs.meal : undefined;
        let from: DayKey;
        let to: DayKey;
        if (rawArgs.date) {
          const d = resolveDate(rawArgs.date, ctx.selectedDate);
          if (!d.ok) return d.result;
          from = d.date;
          to = d.date;
        } else {
          const daysBack =
            typeof rawArgs.days_back === 'number'
              ? Math.max(1, Math.min(60, Math.floor(rawArgs.days_back)))
              : 14;
          to = todayKey();
          from = addDays(to, -daysBack);
        }
        const range = await repos.diary.entriesForRange(from, to);
        const matches = range.filter((e) => {
          if (mealFilter && e.meal !== mealFilter) return false;
          return e.name.toLowerCase().includes(query);
        });
        return {
          ok: true,
          data: {
            from,
            to,
            count: matches.length,
            entries: matches.map((e) => ({
              id: e.id,
              date: e.date,
              meal: e.meal,
              name: e.name,
              calories: Math.round(e.nutrition.calories),
            })),
          },
          invalidates: [],
        };
      }

      case 'add_meal': {
        const dedupe = idempotentGuard(ctx, name, rawArgs);
        if (dedupe) return dedupe;
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const date = d.date;
        const foodName = String(rawArgs.name ?? '').trim();
        const calories = Number(rawArgs.calories);
        if (!foodName || !Number.isFinite(calories)) {
          return fail('name and calories are required');
        }
        const meal =
          typeof rawArgs.meal === 'string' && rawArgs.meal
            ? rawArgs.meal
            : ctx.targetMeal || 'snacks';
        const entry = await repos.diary.add({
          date,
          meal,
          name: foodName,
          sourceType: 'manual',
          quantity: 1,
          unit: 'serving',
          servingDesc:
            typeof rawArgs.serving_desc === 'string' ? rawArgs.serving_desc : undefined,
          nutrition: {
            calories,
            protein: numOrUndef(rawArgs.protein),
            carbs: numOrUndef(rawArgs.carbs),
            fat: numOrUndef(rawArgs.fat),
            fiber: numOrUndef(rawArgs.fiber),
          },
          notes: typeof rawArgs.notes === 'string' ? rawArgs.notes : undefined,
        });
        await repos.history.recordLog(`manual:${entry.id}`, foodName, meal);
        const summary = `Logged ${foodName} (${Math.round(calories)} kcal) to ${meal} on ${date}`;
        const next = pushUndo(ctx.memory, {
          kind: 'add_meal',
          id: entry.id,
          date,
          summary,
        });
        markMutation(ctx, name, rawArgs, summary, next);
        return {
          ok: true,
          data: { id: entry.id, date, meal, name: foodName, calories: Math.round(calories), message: summary },
          invalidates: [{ kind: 'diary', date }],
        };
      }

      case 'update_diary_entry': {
        const id = String(rawArgs.id ?? '');
        if (!id) return fail('id required');
        const today = todayKey();
        const range = await repos.diary.entriesForRange(addDays(today, -120), addDays(today, 14));
        const existing = range.find((e) => e.id === id);
        if (!existing) return fail('Entry not found');
        const patch: Record<string, unknown> = {};
        if (typeof rawArgs.name === 'string') patch.name = rawArgs.name;
        if (typeof rawArgs.meal === 'string') patch.meal = rawArgs.meal;
        if (typeof rawArgs.notes === 'string') patch.notes = rawArgs.notes;
        const hasNut =
          rawArgs.calories != null ||
          rawArgs.protein != null ||
          rawArgs.carbs != null ||
          rawArgs.fat != null;
        if (hasNut) {
          patch.nutrition = {
            ...existing.nutrition,
            calories:
              rawArgs.calories != null ? Number(rawArgs.calories) : existing.nutrition.calories,
            protein:
              rawArgs.protein != null ? Number(rawArgs.protein) : existing.nutrition.protein,
            carbs: rawArgs.carbs != null ? Number(rawArgs.carbs) : existing.nutrition.carbs,
            fat: rawArgs.fat != null ? Number(rawArgs.fat) : existing.nutrition.fat,
          };
        }
        const updated = await repos.diary.update(id, patch as never);
        return {
          ok: true,
          data: { id, name: updated.name, date: updated.date },
          invalidates: [{ kind: 'diary', date: updated.date }],
        };
      }

      case 'delete_diary_entry': {
        const idArg = typeof rawArgs.id === 'string' ? rawArgs.id.trim() : '';
        const contains =
          typeof rawArgs.contains === 'string' ? rawArgs.contains.trim().toLowerCase() : '';
        const mealFilter = typeof rawArgs.meal === 'string' ? rawArgs.meal : undefined;

        let targetId = idArg;
        let entryDate: DayKey | undefined;
        let deletedSnap:
          | {
              date: DayKey;
              meal: string;
              name: string;
              quantity: number;
              unit: string;
              nutrition: { calories: number; protein?: number; carbs?: number; fat?: number };
              notes?: string;
            }
          | undefined;

        if (!targetId) {
          if (!contains) return fail('Provide id or contains (food name)');
          let from: DayKey;
          let to: DayKey;
          if (rawArgs.date) {
            const d = resolveDate(rawArgs.date, ctx.selectedDate);
            if (!d.ok) return d.result;
            from = d.date;
            to = d.date;
          } else {
            to = todayKey();
            from = addDays(to, -14);
          }
          const range = await repos.diary.entriesForRange(from, to);
          const matches = range.filter((e) => {
            if (mealFilter && e.meal !== mealFilter) return false;
            return e.name.toLowerCase().includes(contains);
          });
          if (!matches.length) return fail(`No food matching “${rawArgs.contains}”`);
          if (matches.length > 1) {
            return {
              ok: false,
              data: {
                ambiguous: true,
                error: 'Multiple foods matched — ask the user which one',
                candidates: matches.map((e) => ({
                  id: e.id,
                  date: e.date,
                  meal: e.meal,
                  name: e.name,
                  calories: Math.round(e.nutrition.calories),
                })),
              },
              invalidates: [],
              speakNow: `I found ${matches.length} matching foods — which one should I delete?`,
            };
          }
          targetId = matches[0]!.id;
          entryDate = matches[0]!.date;
          deletedSnap = {
            date: matches[0]!.date,
            meal: matches[0]!.meal,
            name: matches[0]!.name,
            quantity: matches[0]!.quantity,
            unit: matches[0]!.unit,
            nutrition: matches[0]!.nutrition,
            notes: matches[0]!.notes,
          };
        } else {
          const today = todayKey();
          const range = await repos.diary.entriesForRange(addDays(today, -120), addDays(today, 14));
          const hit = range.find((e) => e.id === targetId);
          if (!hit) return fail('Entry not found');
          entryDate = hit.date;
          deletedSnap = {
            date: hit.date,
            meal: hit.meal,
            name: hit.name,
            quantity: hit.quantity,
            unit: hit.unit,
            nutrition: hit.nutrition,
            notes: hit.notes,
          };
        }

        await repos.diary.remove(targetId);
        const summary = `Deleted ${deletedSnap?.name ?? 'food'} from ${deletedSnap?.meal ?? 'diary'} on ${entryDate}`;
        const next = pushUndo(ctx.memory, {
          kind: 'delete_meal',
          date: deletedSnap!.date,
          meal: deletedSnap!.meal,
          name: deletedSnap!.name,
          quantity: deletedSnap!.quantity,
          unit: deletedSnap!.unit,
          nutrition: deletedSnap!.nutrition,
          notes: deletedSnap!.notes,
          summary,
        });
        markMutation(ctx, name, rawArgs, summary, next);
        return {
          ok: true,
          data: { deleted: targetId, date: entryDate, message: summary },
          invalidates: [{ kind: 'diary', date: entryDate }],
        };
      }

      case 'delete_diary_entries': {
        const ids = Array.isArray(rawArgs.ids) ? rawArgs.ids.map(String) : [];
        if (!ids.length) return fail('ids required');
        if (ids.length > 1) {
          return {
            ok: false,
            data: {
              error: 'Refusing to bulk-delete without confirmation — delete one at a time or name the food',
            },
            invalidates: [],
            speakNow: 'I can delete one food at a time — which one?',
          };
        }
        return executeAssistantTool('delete_diary_entry', { id: ids[0] }, ctx);
      }

      case 'list_notes': {
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const notes = await repos.dayNotes.listForDate(d.date);
        return {
          ok: true,
          data: {
            date: d.date,
            notes: notes.map((n) => ({ id: n.id, body: n.body, date: n.date })),
          },
          invalidates: [],
        };
      }

      case 'find_notes': {
        const toR = resolveDate(rawArgs.to ?? 'today', ctx.selectedDate);
        if (!toR.ok) return toR.result;
        const to = toR.date;
        const daysBack =
          typeof rawArgs.days_back === 'number' && Number.isFinite(rawArgs.days_back)
            ? Math.max(1, Math.min(90, Math.floor(rawArgs.days_back)))
            : 30;
        const fromR = rawArgs.from
          ? resolveDate(rawArgs.from, ctx.selectedDate)
          : { ok: true as const, date: addDays(to, -daysBack) };
        if (!fromR.ok) return fromR.result;
        const from = fromR.date;
        const query =
          typeof rawArgs.query === 'string' ? rawArgs.query.trim().toLowerCase() : '';
        const dates = await repos.dayNotes.datesWithNotes(from, to);
        const all = [];
        for (const dayKey of dates) {
          const notes = await repos.dayNotes.listForDate(dayKey);
          for (const n of notes) {
            if (!query || n.body.toLowerCase().includes(query)) {
              all.push({ id: n.id, date: n.date, body: n.body });
            }
          }
        }
        return { ok: true, data: { from, to, count: all.length, notes: all }, invalidates: [] };
      }

      case 'add_note': {
        const dedupe = idempotentGuard(ctx, name, rawArgs);
        if (dedupe) return dedupe;
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const date = d.date;
        let body = typeof rawArgs.body === 'string' ? rawArgs.body.trim() : '';
        if (!body || /^(that|it|the answer|this)$/i.test(body)) {
          body = (ctx.memory.lastAnswer ?? '').trim();
        }
        if (!body) {
          return fail(
            'No note text and no previous answer to save. Ask something first, then say make a note of that.',
          );
        }
        const note = await repos.dayNotes.add(date, body);
        const summary = `Saved note on ${date}`;
        const next = pushUndo(ctx.memory, {
          kind: 'add_note',
          id: note.id,
          date,
          summary: `${summary}: ${body.slice(0, 60)}`,
        });
        markMutation(ctx, name, rawArgs, summary, next);
        return {
          ok: true,
          data: { id: note.id, date, body: note.body, message: summary },
          invalidates: [{ kind: 'notes', date }],
        };
      }

      case 'update_note': {
        const id = String(rawArgs.id ?? '');
        const body = String(rawArgs.body ?? '').trim();
        if (!id || !body) return fail('id and body required');
        const note = await repos.dayNotes.update(id, body);
        return {
          ok: true,
          data: { id: note.id, date: note.date, body: note.body },
          invalidates: [{ kind: 'notes', date: note.date }],
        };
      }

      case 'delete_note': {
        const idArg = typeof rawArgs.id === 'string' ? rawArgs.id.trim() : '';
        const contains =
          typeof rawArgs.contains === 'string' ? rawArgs.contains.trim().toLowerCase() : '';
        const scoped =
          typeof rawArgs.date === 'string' && rawArgs.date.trim()
            ? resolveDate(rawArgs.date, ctx.selectedDate)
            : null;
        if (scoped && !scoped.ok) return scoped.result;

        let targetId = idArg;
        let noteDate: DayKey | undefined = scoped?.ok ? scoped.date : undefined;
        let deletedBody: string | undefined;

        if (!targetId) {
          if (!contains) return fail('Provide id or contains (text from the note)');
          const to = noteDate ?? todayKey();
          const from = noteDate ?? addDays(to, -90);
          const dates = noteDate
            ? [noteDate]
            : await repos.dayNotes.datesWithNotes(from, to);
          const matches: { id: string; date: DayKey; body: string }[] = [];
          for (const dayKey of [...dates].reverse()) {
            const notes = await repos.dayNotes.listForDate(dayKey);
            for (const n of [...notes].reverse()) {
              if (n.body.toLowerCase().includes(contains)) {
                matches.push({ id: n.id, date: n.date, body: n.body });
              }
            }
          }
          if (!matches.length) return fail(`No note matching “${rawArgs.contains}”`);
          if (matches.length > 1) {
            return {
              ok: false,
              data: {
                ambiguous: true,
                error: 'Multiple notes matched — ask which one',
                candidates: matches.map((m) => ({
                  id: m.id,
                  date: m.date,
                  body: m.body.slice(0, 120),
                })),
              },
              invalidates: [],
              speakNow: `I found ${matches.length} matching notes — which one should I delete?`,
            };
          }
          targetId = matches[0]!.id;
          noteDate = matches[0]!.date;
          deletedBody = matches[0]!.body;
        } else if (!noteDate) {
          const to = todayKey();
          const from = addDays(to, -90);
          const dates = await repos.dayNotes.datesWithNotes(from, to);
          for (const dayKey of dates) {
            const notes = await repos.dayNotes.listForDate(dayKey);
            const hit = notes.find((n) => n.id === targetId);
            if (hit) {
              noteDate = dayKey;
              deletedBody = hit.body;
              break;
            }
          }
        } else {
          const notes = await repos.dayNotes.listForDate(noteDate);
          deletedBody = notes.find((n) => n.id === targetId)?.body;
        }

        if (!deletedBody && !targetId) return fail('Note not found');
        await repos.dayNotes.remove(targetId);
        const summary = deletedBody
          ? `Deleted note: ${deletedBody.slice(0, 80)}`
          : `Deleted note ${targetId}`;
        const next = pushUndo(ctx.memory, {
          kind: 'delete_note',
          date: noteDate ?? ctx.selectedDate,
          body: deletedBody ?? '',
          summary,
        });
        markMutation(ctx, name, rawArgs, summary, next);
        return {
          ok: true,
          data: { deleted: targetId, date: noteDate ?? null, body: deletedBody ?? null, message: summary },
          invalidates: [{ kind: 'notes', date: noteDate }],
        };
      }

      case 'list_activities': {
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const entries = await repos.activity.entriesForDate(d.date);
        return {
          ok: true,
          data: {
            date: d.date,
            activities: entries.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.activityType,
              caloriesBurned: Math.round(a.caloriesBurned),
              durationMin: a.durationMin,
            })),
          },
          invalidates: [],
        };
      }

      case 'add_activity': {
        const dedupe = idempotentGuard(ctx, name, rawArgs);
        if (dedupe) return dedupe;
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const date = d.date;
        const actName = String(rawArgs.name ?? '').trim();
        const caloriesBurned = Number(rawArgs.calories_burned);
        if (!actName || !Number.isFinite(caloriesBurned)) {
          return fail('name and calories_burned required');
        }
        const activityType =
          typeof rawArgs.activity_type === 'string'
            ? (rawArgs.activity_type as 'cardio' | 'strength' | 'sports' | 'mobility' | 'other')
            : 'other';
        const entry = await repos.activity.add({
          date,
          name: actName,
          activityType,
          caloriesBurned,
          durationMin: numOrUndef(rawArgs.duration_min),
          intensity:
            typeof rawArgs.intensity === 'string'
              ? (rawArgs.intensity as 'easy' | 'moderate' | 'hard')
              : undefined,
          notes: typeof rawArgs.notes === 'string' ? rawArgs.notes : undefined,
          sourceType: 'manual',
        });
        const summary = `Logged ${actName} (${Math.round(caloriesBurned)} kcal burned) on ${date}`;
        const next = pushUndo(ctx.memory, {
          kind: 'add_activity',
          id: entry.id,
          date,
          summary,
        });
        markMutation(ctx, name, rawArgs, summary, next);
        return {
          ok: true,
          data: {
            id: entry.id,
            date,
            name: actName,
            caloriesBurned: Math.round(entry.caloriesBurned),
            message: summary,
          },
          invalidates: [{ kind: 'activity', date }],
        };
      }

      case 'delete_activity': {
        const id = String(rawArgs.id ?? '');
        if (!id) return fail('id required');
        await repos.activity.remove(id);
        return { ok: true, data: { deleted: id }, invalidates: [{ kind: 'activity' }] };
      }

      case 'list_recent_foods': {
        const limit =
          typeof rawArgs.limit === 'number' ? Math.max(1, Math.min(30, rawArgs.limit)) : 10;
        const foods = await repos.history.recentFoods(limit);
        return { ok: true, data: { foods }, invalidates: [] };
      }

      case 'get_goals': {
        const d = resolveDate(rawArgs.date, ctx.selectedDate);
        if (!d.ok) return d.result;
        const date = d.date;
        const config = await repos.goals.configFor(date);
        if (!config) {
          return { ok: true, data: { date, error: 'No goals configured' }, invalidates: [] };
        }
        const marks = await repos.goals.getMarks(date, date);
        const progress = dayProgress(date, [], config, marks, 0);
        return {
          ok: true,
          data: {
            date,
            targetCalories: Math.round(progress.target.calories),
            targetProtein: Math.round(progress.target.protein ?? 0),
            targetCarbs: Math.round(progress.target.carbs ?? 0),
            targetFat: Math.round(progress.target.fat ?? 0),
            mode: config.mode,
          },
          invalidates: [],
        };
      }

      case 'undo_last_action': {
        const { memory: afterPop, record } = popUndo(ctx.memory);
        if (!record) {
          return {
            ok: false,
            data: { error: 'Nothing to undo' },
            invalidates: [],
            speakNow: "There's nothing for me to undo.",
          };
        }
        let invalidates: ToolInvalidate[] = [];
        switch (record.kind) {
          case 'add_note':
            await repos.dayNotes.remove(record.id);
            invalidates = [{ kind: 'notes', date: record.date }];
            break;
          case 'delete_note':
            await repos.dayNotes.add(record.date, record.body || '(restored note)');
            invalidates = [{ kind: 'notes', date: record.date }];
            break;
          case 'add_meal':
            await repos.diary.remove(record.id);
            invalidates = [{ kind: 'diary', date: record.date }];
            break;
          case 'delete_meal':
            await repos.diary.add({
              date: record.date,
              meal: record.meal,
              name: record.name,
              sourceType: 'manual',
              quantity: record.quantity,
              unit: record.unit,
              nutrition: record.nutrition,
              notes: record.notes,
            });
            invalidates = [{ kind: 'diary', date: record.date }];
            break;
          case 'add_activity':
            await repos.activity.remove(record.id);
            invalidates = [{ kind: 'activity', date: record.date }];
            break;
        }
        commitMemory(ctx, afterPop);
        return {
          ok: true,
          data: { undone: record.summary, message: `Undid: ${record.summary}` },
          invalidates,
          speakNow: `Undid that — ${record.summary}`,
        };
      }

      case 'remember_fact': {
        const fact = String(rawArgs.fact ?? '').trim();
        if (!fact) return fail('fact required');
        const next = pinFact(ctx.memory, fact);
        commitMemory(ctx, next);
        return {
          ok: true,
          data: { saved: fact, message: 'Pinned to memory' },
          invalidates: [{ kind: 'memory' }],
        };
      }

      case 'forget_fact': {
        const contains = String(rawArgs.contains ?? '').trim();
        if (!contains) return fail('contains required');
        const next = forgetFact(ctx.memory, contains);
        commitMemory(ctx, next);
        return {
          ok: true,
          data: { removedMatching: contains, factsLeft: next.facts },
          invalidates: [{ kind: 'memory' }],
        };
      }

      case 'recall_memory': {
        return { ok: true, data: recallFriendly(ctx.memory), invalidates: [] };
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return {
      ok: false,
      data: { error: e instanceof Error ? e.message : 'Tool failed' },
      invalidates: [],
    };
  }
}

/** @deprecated kept for tests that imported load path */
export { loadAssistantMemory };
