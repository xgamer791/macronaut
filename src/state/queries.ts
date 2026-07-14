import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DayKey, weekDays } from '@/utils/date';
import { DayProgress, WeekProgress, dayProgress, weekProgress } from '@/domain/aggregation';
import { GoalConfig } from '@/domain/goals';
import { WeekStart } from '@/domain/types';
import { NewActivityEntry } from '@/repositories/activityRepo';
import { NewDiaryEntry } from '@/repositories/diaryRepo';
import { DiaryEntry } from '@/repositories/types';
import { useRepos } from './AppProvider';

/** Query keys — every mutation invalidates by prefix so Today, Diary, weekly
 * and Progress views recompute immediately after any change. */
export const keys = {
  diary: (date: DayKey) => ['diary', date] as const,
  diaryRange: (from: DayKey, to: DayKey) => ['diary-range', from, to] as const,
  activity: (date: DayKey) => ['activity', date] as const,
  activityRange: (from: DayKey, to: DayKey) => ['activity-range', from, to] as const,
  dayNote: (date: DayKey) => ['day-note', date] as const,
  dayNotesRange: (from: DayKey, to: DayKey) => ['day-notes-range', from, to] as const,
  goals: ['goals'] as const,
  marks: ['marks'] as const,
  setting: (key: string) => ['setting', key] as const,
  mealCategories: ['meal-categories'] as const,
  customFoods: (q: string) => ['custom-foods', q] as const,
  savedMeals: (q: string) => ['saved-meals', q] as const,
  recipes: (q: string) => ['recipes', q] as const,
  recents: ['recents'] as const,
  frequents: (meal?: string) => ['frequents', meal ?? ''] as const,
  favorites: ['favorites'] as const,
};

export function useInvalidateDiary() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['diary'] });
    qc.invalidateQueries({ queryKey: ['diary-range'] });
    qc.invalidateQueries({ queryKey: keys.recents });
    qc.invalidateQueries({ queryKey: ['frequents'] });
  };
}

export function useInvalidateActivity() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['activity'] });
    qc.invalidateQueries({ queryKey: ['activity-range'] });
  };
}

export function useDayNote(date: DayKey) {
  const { dayNotes } = useRepos();
  return useQuery({ queryKey: keys.dayNote(date), queryFn: () => dayNotes.get(date) });
}

export function useDayNotesRange(from: DayKey, to: DayKey) {
  const { dayNotes } = useRepos();
  return useQuery({
    queryKey: keys.dayNotesRange(from, to),
    queryFn: () => dayNotes.datesWithNotes(from, to),
  });
}

export function useSetDayNote() {
  const { dayNotes } = useRepos();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: DayKey; body: string }) => dayNotes.set(input.date, input.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.dayNote(vars.date) });
      qc.invalidateQueries({ queryKey: ['day-notes-range'] });
    },
  });
}

export function useDiaryEntries(date: DayKey) {
  const { diary } = useRepos();
  return useQuery({ queryKey: keys.diary(date), queryFn: () => diary.entriesForDate(date) });
}

export function useDiaryRange(from: DayKey, to: DayKey) {
  const { diary } = useRepos();
  return useQuery({
    queryKey: keys.diaryRange(from, to),
    queryFn: () => diary.entriesForRange(from, to),
  });
}

export function useActivityEntries(date: DayKey) {
  const { activity } = useRepos();
  return useQuery({ queryKey: keys.activity(date), queryFn: () => activity.entriesForDate(date) });
}

export function useActivityRange(from: DayKey, to: DayKey) {
  const { activity } = useRepos();
  return useQuery({
    queryKey: keys.activityRange(from, to),
    queryFn: () => activity.entriesForRange(from, to),
  });
}

export function useGoalConfigs() {
  const { goals } = useRepos();
  return useQuery({ queryKey: keys.goals, queryFn: () => goals.listConfigs() });
}

export function useDayTypeMarks() {
  const { goals } = useRepos();
  return useQuery({ queryKey: keys.marks, queryFn: () => goals.allMarks() });
}

export function useSetting<T>(key: string, fallback: T) {
  const { settings } = useRepos();
  return useQuery({
    queryKey: keys.setting(key),
    queryFn: () => settings.get<T>(key, fallback),
  });
}

export function useWeekStart(): WeekStart {
  return useSetting<WeekStart>('weekStart', 'monday').data ?? 'monday';
}

export function useMealCategories() {
  const { settings } = useRepos();
  return useQuery({ queryKey: keys.mealCategories, queryFn: () => settings.getMealCategories() });
}

/** Add a diary entry + record history, invalidating all totals. */
export function useAddDiaryEntry() {
  const { diary, history } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: async (input: { entry: NewDiaryEntry; foodKey?: string }) => {
      const added = await diary.add(input.entry);
      if (input.foodKey) {
        await history.recordLog(
          input.foodKey,
          input.entry.name,
          input.entry.meal,
          input.entry.imageUrl,
        );
      }
      return added;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateDiaryEntry() {
  const { diary } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewDiaryEntry> }) =>
      diary.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteDiaryEntries() {
  const { diary } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: (ids: string[]) => diary.removeMany(ids),
    onSuccess: invalidate,
  });
}

export function useAddActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: (entry: NewActivityEntry) => activity.add(entry),
    onSuccess: invalidate,
  });
}

export function useUpdateActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewActivityEntry> }) =>
      activity.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: (id: string) => activity.remove(id),
    onSuccess: invalidate,
  });
}

/** Compute a day's progress from food + activity burn + the goal in effect. */
export function useDayProgress(date: DayKey): DayProgress | null {
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();
  if (!entries.data || !activities.data || !configs.data || !marks.data) return null;
  const config = pickConfig(date, configs.data);
  if (!config) return null;
  const burned = activities.data.reduce((sum, a) => sum + a.caloriesBurned, 0);
  return dayProgress(
    date,
    entries.data.map((e: DiaryEntry) => e.nutrition),
    config,
    marks.data,
    burned,
  );
}

/** Compute weekly progress for the week containing `date`. */
export function useWeekProgress(date: DayKey): WeekProgress | null {
  const weekStart = useWeekStart();
  const days = weekDays(date, weekStart);
  const range = useDiaryRange(days[0], days[6]);
  const activityRange = useActivityRange(days[0], days[6]);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();
  if (!range.data || !activityRange.data || !configs.data || !marks.data) return null;
  const config = pickConfig(date, configs.data);
  if (!config) return null;
  const byDay: Record<DayKey, { calories: number }[]> = {};
  for (const e of range.data) {
    (byDay[e.date] ??= []).push(e.nutrition);
  }
  const burnedByDay: Record<DayKey, number> = {};
  for (const a of activityRange.data) {
    burnedByDay[a.date] = (burnedByDay[a.date] ?? 0) + a.caloriesBurned;
  }
  return weekProgress(days, byDay, config, marks.data, burnedByDay);
}

function pickConfig(date: DayKey, configs: GoalConfig[]): GoalConfig | null {
  if (configs.length === 0) return null;
  let chosen = configs[0];
  for (const c of configs) {
    if (c.effectiveFrom <= date) chosen = c;
    else break;
  }
  return chosen;
}
