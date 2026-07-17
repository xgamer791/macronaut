import { dayProgress } from '@/domain/aggregation';
import type { Repos } from '@/state/AppProvider';
import { addDays, todayKey, type DayKey } from '@/utils/date';
import { resolveDayKey } from './dateResolve';
import {
  loadAssistantMemory,
  pinFact,
  recallFriendly,
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
  /** UI-selected date when relative dates omitted. */
  selectedDate: DayKey;
  /** Default meal slot for new foods. */
  targetMeal: string;
  memory: AssistantMemoryStore;
  onMemoryChange: (next: AssistantMemoryStore) => void;
}

export interface ToolExecResult {
  ok: boolean;
  data: unknown;
  invalidates: ToolInvalidate[];
}

function roundNut(n: number | undefined): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Math.round(n * 10) / 10;
}

export async function executeAssistantTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<ToolExecResult> {
  const { repos } = ctx;
  const day = (d?: unknown) =>
    resolveDayKey(typeof d === 'string' ? d : undefined, ctx.selectedDate || todayKey());

  try {
    switch (name) {
      case 'get_day_summary': {
        const date = day(rawArgs.date);
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
        const date = day(rawArgs.date);
        const entries = await repos.diary.entriesForDate(date);
        return {
          ok: true,
          data: {
            date,
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

      case 'add_meal': {
        const date = day(rawArgs.date);
        const name = String(rawArgs.name ?? '').trim();
        const calories = Number(rawArgs.calories);
        if (!name || !Number.isFinite(calories)) {
          return { ok: false, data: { error: 'name and calories are required' }, invalidates: [] };
        }
        const meal =
          typeof rawArgs.meal === 'string' && rawArgs.meal
            ? rawArgs.meal
            : ctx.targetMeal || 'snacks';
        const entry = await repos.diary.add({
          date,
          meal,
          name,
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
        await repos.history.recordLog(`manual:${entry.id}`, name, meal);
        return {
          ok: true,
          data: {
            id: entry.id,
            date,
            meal,
            name,
            calories: Math.round(entry.nutrition.calories),
            message: `Logged ${name} (${Math.round(calories)} kcal) to ${meal} on ${date}`,
          },
          invalidates: [{ kind: 'diary', date }],
        };
      }

      case 'update_diary_entry': {
        const id = String(rawArgs.id ?? '');
        if (!id) return { ok: false, data: { error: 'id required' }, invalidates: [] };
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
          // Load current via range search is hard — update nutrition from provided fields only.
          // Diary update accepts Partial<NewDiaryEntry>; we need existing nutrition.
          const today = todayKey();
          const range = await repos.diary.entriesForRange(addDays(today, -60), addDays(today, 7));
          const existing = range.find((e) => e.id === id);
          if (!existing) {
            return { ok: false, data: { error: 'Entry not found' }, invalidates: [] };
          }
          patch.nutrition = {
            ...existing.nutrition,
            calories:
              rawArgs.calories != null ? Number(rawArgs.calories) : existing.nutrition.calories,
            protein:
              rawArgs.protein != null ? Number(rawArgs.protein) : existing.nutrition.protein,
            carbs: rawArgs.carbs != null ? Number(rawArgs.carbs) : existing.nutrition.carbs,
            fat: rawArgs.fat != null ? Number(rawArgs.fat) : existing.nutrition.fat,
          };
          const updated = await repos.diary.update(id, patch as never);
          return {
            ok: true,
            data: { id, name: updated.name, date: updated.date },
            invalidates: [{ kind: 'diary', date: updated.date }],
          };
        }
        const updated = await repos.diary.update(id, patch as never);
        return {
          ok: true,
          data: { id, name: updated.name, date: updated.date },
          invalidates: [{ kind: 'diary', date: updated.date }],
        };
      }

      case 'delete_diary_entries': {
        const ids = Array.isArray(rawArgs.ids) ? rawArgs.ids.map(String) : [];
        if (!ids.length) return { ok: false, data: { error: 'ids required' }, invalidates: [] };
        await repos.diary.removeMany(ids);
        return {
          ok: true,
          data: { deleted: ids.length, ids },
          invalidates: [{ kind: 'diary' }],
        };
      }

      case 'list_notes': {
        const date = day(rawArgs.date);
        const notes = await repos.dayNotes.listForDate(date);
        return {
          ok: true,
          data: {
            date,
            notes: notes.map((n) => ({ id: n.id, body: n.body, date: n.date })),
          },
          invalidates: [],
        };
      }

      case 'find_notes': {
        const to = day(rawArgs.to ?? 'today');
        const daysBack =
          typeof rawArgs.days_back === 'number' && Number.isFinite(rawArgs.days_back)
            ? Math.max(1, Math.min(90, Math.floor(rawArgs.days_back)))
            : 30;
        const from = rawArgs.from
          ? day(rawArgs.from)
          : addDays(to, -daysBack);
        const query =
          typeof rawArgs.query === 'string' ? rawArgs.query.trim().toLowerCase() : '';
        const dates = await repos.dayNotes.datesWithNotes(from, to);
        const all = [];
        for (const d of dates) {
          const notes = await repos.dayNotes.listForDate(d);
          for (const n of notes) {
            if (!query || n.body.toLowerCase().includes(query)) {
              all.push({ id: n.id, date: n.date, body: n.body });
            }
          }
        }
        return { ok: true, data: { from, to, count: all.length, notes: all }, invalidates: [] };
      }

      case 'add_note': {
        const date = day(rawArgs.date);
        let body = typeof rawArgs.body === 'string' ? rawArgs.body.trim() : '';
        // If they said "note that" with empty/placeholder body, use last answer.
        if (!body || /^(that|it|the answer|this)$/i.test(body)) {
          body = (ctx.memory.lastAnswer ?? '').trim();
        }
        if (!body) {
          return {
            ok: false,
            data: {
              error:
                'No note text and no previous answer to save. Ask something first, then say make a note of that.',
            },
            invalidates: [],
          };
        }
        const note = await repos.dayNotes.add(date, body);
        return {
          ok: true,
          data: {
            id: note.id,
            date: note.date,
            body: note.body,
            message: `Saved note on ${date}`,
          },
          invalidates: [{ kind: 'notes', date }],
        };
      }

      case 'update_note': {
        const id = String(rawArgs.id ?? '');
        const body = String(rawArgs.body ?? '').trim();
        if (!id || !body) {
          return { ok: false, data: { error: 'id and body required' }, invalidates: [] };
        }
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
        const scopedDate =
          typeof rawArgs.date === 'string' && rawArgs.date.trim()
            ? day(rawArgs.date)
            : undefined;

        let targetId = idArg;
        let noteDate: DayKey | undefined = scopedDate;
        let deletedBody: string | undefined;

        if (!targetId) {
          if (!contains) {
            return {
              ok: false,
              data: { error: 'Provide id or contains (text from the note) to delete' },
              invalidates: [],
            };
          }
          const to = scopedDate ?? todayKey();
          const from = scopedDate ?? addDays(to, -90);
          const dates = scopedDate
            ? [scopedDate]
            : await repos.dayNotes.datesWithNotes(from, to);
          // Newest first so "delete the one about X" picks the latest match.
          const matches: { id: string; date: DayKey; body: string }[] = [];
          for (const d of [...dates].reverse()) {
            const notes = await repos.dayNotes.listForDate(d);
            for (const n of [...notes].reverse()) {
              if (n.body.toLowerCase().includes(contains)) {
                matches.push({ id: n.id, date: n.date, body: n.body });
              }
            }
          }
          if (!matches.length) {
            return {
              ok: false,
              data: { error: `No note matching “${rawArgs.contains}”` },
              invalidates: [],
            };
          }
          targetId = matches[0]!.id;
          noteDate = matches[0]!.date;
          deletedBody = matches[0]!.body;
        } else if (!noteDate) {
          const to = todayKey();
          const from = addDays(to, -90);
          const dates = await repos.dayNotes.datesWithNotes(from, to);
          for (const d of dates) {
            const notes = await repos.dayNotes.listForDate(d);
            const hit = notes.find((n) => n.id === targetId);
            if (hit) {
              noteDate = d;
              deletedBody = hit.body;
              break;
            }
          }
        }

        await repos.dayNotes.remove(targetId);
        return {
          ok: true,
          data: {
            deleted: targetId,
            date: noteDate ?? null,
            body: deletedBody ?? null,
            message: deletedBody
              ? `Deleted note: ${deletedBody.slice(0, 80)}`
              : `Deleted note ${targetId}`,
          },
          invalidates: [{ kind: 'notes', date: noteDate }],
        };
      }

      case 'list_activities': {
        const date = day(rawArgs.date);
        const entries = await repos.activity.entriesForDate(date);
        return {
          ok: true,
          data: {
            date,
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
        const date = day(rawArgs.date);
        const name = String(rawArgs.name ?? '').trim();
        const caloriesBurned = Number(rawArgs.calories_burned);
        if (!name || !Number.isFinite(caloriesBurned)) {
          return {
            ok: false,
            data: { error: 'name and calories_burned required' },
            invalidates: [],
          };
        }
        const activityType =
          typeof rawArgs.activity_type === 'string'
            ? (rawArgs.activity_type as 'cardio' | 'strength' | 'sports' | 'mobility' | 'other')
            : 'other';
        const entry = await repos.activity.add({
          date,
          name,
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
        return {
          ok: true,
          data: {
            id: entry.id,
            date,
            name,
            caloriesBurned: Math.round(entry.caloriesBurned),
            message: `Logged ${name} (${Math.round(caloriesBurned)} kcal burned) on ${date}`,
          },
          invalidates: [{ kind: 'activity', date }],
        };
      }

      case 'delete_activity': {
        const id = String(rawArgs.id ?? '');
        if (!id) return { ok: false, data: { error: 'id required' }, invalidates: [] };
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
        const date = day(rawArgs.date);
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

      case 'remember_fact': {
        const fact = String(rawArgs.fact ?? '').trim();
        if (!fact) return { ok: false, data: { error: 'fact required' }, invalidates: [] };
        const next = pinFact(ctx.memory, fact);
        ctx.onMemoryChange(next);
        await saveAssistantMemory(repos.settings, next);
        return {
          ok: true,
          data: { saved: fact, message: 'Pinned to memory' },
          invalidates: [{ kind: 'memory' }],
        };
      }

      case 'recall_memory': {
        const mem = await loadAssistantMemory(repos.settings);
        return { ok: true, data: recallFriendly(mem), invalidates: [] };
      }

      default:
        return { ok: false, data: { error: `Unknown tool: ${name}` }, invalidates: [] };
    }
  } catch (e) {
    return {
      ok: false,
      data: { error: e instanceof Error ? e.message : 'Tool failed' },
      invalidates: [],
    };
  }
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
