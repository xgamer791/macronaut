import { WeekStart } from '@/domain/types';

/** Day keys are local-calendar 'YYYY-MM-DD' strings. All diary/goal logic
 * operates on day keys, never Date objects, so timezone shifts can't move an
 * entry to a different day. */
export type DayKey = string;

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseDayKey(key);
  return toDayKey(d) === key;
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return toDayKey(d);
}

/** 0 = Sunday … 6 = Saturday (JS convention). */
export function weekdayOf(key: DayKey): number {
  return parseDayKey(key).getDay();
}

/** First day of the week containing `key`, honoring the configured start. */
export function weekStartOf(key: DayKey, weekStart: WeekStart): DayKey {
  const wd = weekdayOf(key);
  const offset = weekStart === 'sunday' ? wd : (wd + 6) % 7;
  return addDays(key, -offset);
}

/** The 7 day keys of the week containing `key`. */
export function weekDays(key: DayKey, weekStart: WeekStart): DayKey[] {
  const start = weekStartOf(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function rangeDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDayKey(key: DayKey, today: DayKey = todayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const d = parseDayKey(key);
  return `${WEEKDAY_LABELS[d.getDay()]}, ${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

/** Diary navigator label, e.g. `TODAY, 15 JUL`. */
export function formatDiaryNavLabel(key: DayKey, today: DayKey = todayKey()): string {
  const d = parseDayKey(key);
  const stamp = `${d.getDate()} ${MONTH_LABELS[d.getMonth()].toUpperCase()}`;
  if (key === today) return `TODAY, ${stamp}`;
  if (key === addDays(today, -1)) return `YESTERDAY, ${stamp}`;
  if (key === addDays(today, 1)) return `TOMORROW, ${stamp}`;
  return `${WEEKDAY_LABELS[d.getDay()].toUpperCase()}, ${stamp}`;
}

export function shortWeekdayLabel(key: DayKey): string {
  return WEEKDAY_LABELS[weekdayOf(key)];
}

/** Single-letter weekday (S M T W T F S). */
export function weekdayLetter(key: DayKey): string {
  return WEEKDAY_LABELS[weekdayOf(key)][0];
}

const FULL_MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** First day of the month containing `key`. */
export function monthStartOf(key: DayKey): DayKey {
  const d = parseDayKey(key);
  return toDayKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Shift by whole calendar months; clamps to the 1st of the target month. */
export function addMonths(key: DayKey, months: number): DayKey {
  const d = parseDayKey(key);
  return toDayKey(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

export function formatMonthYear(key: DayKey): string {
  const d = parseDayKey(key);
  return `${FULL_MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Weekday letter row for a week-start preference (7 chars). */
export function weekdayLetters(weekStart: WeekStart): string[] {
  const labels =
    weekStart === 'sunday'
      ? WEEKDAY_LABELS
      : [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
  return labels.map((l) => l[0]);
}

/** 6×7 month grid aligned to `weekStart`. Leading/trailing cells are null. */
export function monthCalendarDays(monthKey: DayKey, weekStart: WeekStart): (DayKey | null)[] {
  const start = monthStartOf(monthKey);
  const d = parseDayKey(start);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstWeekday = weekdayOf(start);
  const startOffset = weekStart === 'sunday' ? firstWeekday : (firstWeekday + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (DayKey | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDayKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push(null);
  }
  return cells;
}

/** Three-letter weekday row for a week-start preference (7 labels). */
export function weekdayShortLabels(weekStart: WeekStart): string[] {
  return weekStart === 'sunday'
    ? [...WEEKDAY_LABELS]
    : [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
}

/** Full month names, January first. */
export const monthNames: readonly string[] = FULL_MONTH_LABELS;

/** Full month name of the month containing `key`. */
export function monthLabel(key: DayKey): string {
  return FULL_MONTH_LABELS[parseDayKey(key).getMonth()];
}

/** Calendar year of `key`. */
export function yearOf(key: DayKey): number {
  return parseDayKey(key).getFullYear();
}

/** Calendar month of `key`, 0 = January. */
export function monthOf(key: DayKey): number {
  return parseDayKey(key).getMonth();
}

/** First of month `month` (0–11), keeping the year of `key`. */
export function withMonth(key: DayKey, month: number): DayKey {
  return toDayKey(new Date(yearOf(key), month, 1));
}

/** First of the same month in `year`. */
export function withYear(key: DayKey, year: number): DayKey {
  return toDayKey(new Date(year, monthOf(key), 1));
}

export interface MonthGridDay {
  key: DayKey;
  /** False for the days that spill in from the neighbouring months. */
  inMonth: boolean;
}

/**
 * 6×7 month grid aligned to `weekStart`. Unlike {@link monthCalendarDays} the
 * leading and trailing cells carry the neighbouring months' real days rather
 * than blanks, so the grid reads as one continuous run of dates.
 */
export function monthGridDays(monthKey: DayKey, weekStart: WeekStart): MonthGridDay[] {
  const start = monthStartOf(monthKey);
  const firstWeekday = weekdayOf(start);
  const offset = weekStart === 'sunday' ? firstWeekday : (firstWeekday + 6) % 7;
  const first = addDays(start, -offset);
  const month = monthOf(start);
  return Array.from({ length: 42 }, (_, i) => {
    const key = addDays(first, i);
    return { key, inMonth: monthOf(key) === month };
  });
}
