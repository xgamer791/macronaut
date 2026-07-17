import { addDays, isValidDayKey, todayKey, type DayKey, weekdayOf } from '@/utils/date';

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Resolve a spoken/relative date string to a DayKey.
 * Accepts YYYY-MM-DD, today/yesterday/tomorrow, "N days ago", "last monday", etc.
 */
export function resolveDayKey(input?: string | null, fallback: DayKey = todayKey()): DayKey {
  if (!input) return fallback;
  const raw = input.trim().toLowerCase();
  if (!raw) return fallback;
  if (isValidDayKey(raw)) return raw;

  if (raw === 'today' || raw === 'tonight') return todayKey();
  if (raw === 'yesterday') return addDays(todayKey(), -1);
  if (raw === 'tomorrow') return addDays(todayKey(), 1);

  const ago = raw.match(/^(\d+)\s*days?\s*ago$/);
  if (ago) return addDays(todayKey(), -Number(ago[1]));

  const ahead = raw.match(/^in\s*(\d+)\s*days?$/);
  if (ahead) return addDays(todayKey(), Number(ahead[1]));

  const lastWeekday = raw.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (lastWeekday) {
    const target = WEEKDAY_NAMES.indexOf(lastWeekday[1]!);
    const today = todayKey();
    const cur = weekdayOf(today);
    let delta = (cur - target + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(today, -delta);
  }

  const thisWeekday = raw.match(
    /^(this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (thisWeekday) {
    const target = WEEKDAY_NAMES.indexOf(thisWeekday[2]!);
    const today = todayKey();
    const cur = weekdayOf(today);
    const delta = (target - cur + 7) % 7;
    return addDays(today, delta === 0 ? 0 : delta - 7); // most recent occurrence this week or today
  }

  // "4 days ago" variants already covered; try loose "days ago"
  const loose = raw.match(/(\d+)\s*day/);
  if (loose && /ago/.test(raw)) return addDays(todayKey(), -Number(loose[1]));

  return fallback;
}
