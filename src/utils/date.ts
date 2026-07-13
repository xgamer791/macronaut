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

export function shortWeekdayLabel(key: DayKey): string {
  return WEEKDAY_LABELS[weekdayOf(key)];
}
