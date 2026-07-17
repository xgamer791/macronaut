import {
  addDays,
  isValidDayKey,
  todayKey,
  type DayKey,
  weekdayOf,
} from '@/utils/date';

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

export type DateResolveResult =
  | { ok: true; date: DayKey }
  | { ok: false; error: string };

/**
 * Resolve a spoken/relative date.
 * - empty/undefined → fallback (selected day)
 * - unrecognized non-empty string → error (do not silently use fallback)
 */
export function tryResolveDayKey(
  input?: string | null,
  fallback: DayKey = todayKey(),
): DateResolveResult {
  if (input == null) return { ok: true, date: fallback };
  const raw = input.trim().toLowerCase();
  if (!raw) return { ok: true, date: fallback };
  if (isValidDayKey(raw)) return { ok: true, date: raw };

  if (raw === 'today' || raw === 'tonight') return { ok: true, date: todayKey() };
  if (raw === 'yesterday') return { ok: true, date: addDays(todayKey(), -1) };
  if (raw === 'tomorrow') return { ok: true, date: addDays(todayKey(), 1) };

  const ago = raw.match(/^(\d+)\s*days?\s*ago$/);
  if (ago) return { ok: true, date: addDays(todayKey(), -Number(ago[1])) };

  const ahead = raw.match(/^(?:in\s*)?(\d+)\s*days?(?:\s*from\s*now)?$/);
  if (ahead && !/ago/.test(raw)) return { ok: true, date: addDays(todayKey(), Number(ahead[1])) };

  if (raw === 'last week') return { ok: true, date: addDays(todayKey(), -7) };

  const lastWeekday = raw.match(
    /^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (lastWeekday) {
    const target = WEEKDAY_NAMES.indexOf(lastWeekday[1]!);
    const today = todayKey();
    const cur = weekdayOf(today);
    let delta = (cur - target + 7) % 7;
    if (delta === 0) delta = 7;
    return { ok: true, date: addDays(today, -delta) };
  }

  const weekdayOnly = raw.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayOnly) {
    const target = WEEKDAY_NAMES.indexOf(weekdayOnly[1]!);
    const today = todayKey();
    const cur = weekdayOf(today);
    let delta = (cur - target + 7) % 7;
    if (delta === 0) delta = 0; // today if same weekday
    else delta = delta; // most recent past occurrence this week
    // Prefer most recent occurrence (today or earlier this week / last week)
    if (delta === 0) return { ok: true, date: today };
    return { ok: true, date: addDays(today, -delta) };
  }

  // "July 4" / "jul 4 2026"
  const md = raw.match(
    /^(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/,
  );
  if (md) {
    const month = MONTHS[md[1]!];
    const dayNum = Number(md[2]);
    const year = md[3] ? Number(md[3]) : new Date().getFullYear();
    if (month != null && dayNum >= 1 && dayNum <= 31) {
      const d = new Date(year, month, dayNum);
      if (d.getMonth() === month && d.getDate() === dayNum) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return { ok: true, date: `${y}-${m}-${day}` };
      }
    }
  }

  return {
    ok: false,
    error: `Could not understand the date “${input.trim()}”. Try today, yesterday, 4 days ago, or YYYY-MM-DD.`,
  };
}

/** Convenience: empty → fallback; invalid non-empty → fallback (legacy). Prefer tryResolveDayKey. */
export function resolveDayKey(input?: string | null, fallback: DayKey = todayKey()): DayKey {
  const r = tryResolveDayKey(input, fallback);
  return r.ok ? r.date : fallback;
}
