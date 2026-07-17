import { addDays, todayKey } from '@/utils/date';
import { resolveDayKey, tryResolveDayKey } from '../dateResolve';

describe('resolveDayKey / tryResolveDayKey', () => {
  it('resolves today and yesterday', () => {
    expect(resolveDayKey('today')).toBe(todayKey());
    expect(resolveDayKey('yesterday')).toBe(addDays(todayKey(), -1));
  });

  it('resolves N days ago', () => {
    expect(resolveDayKey('4 days ago')).toBe(addDays(todayKey(), -4));
    expect(resolveDayKey('1 day ago')).toBe(addDays(todayKey(), -1));
  });

  it('accepts YYYY-MM-DD', () => {
    expect(resolveDayKey('2026-07-01')).toBe('2026-07-01');
  });

  it('falls back when empty', () => {
    expect(resolveDayKey(undefined, '2026-01-01')).toBe('2026-01-01');
  });

  it('errors on unrecognized non-empty dates', () => {
    const r = tryResolveDayKey('next eon', '2026-01-01');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/understand/i);
  });

  it('parses month day', () => {
    const r = tryResolveDayKey('July 4, 2026');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date).toBe('2026-07-04');
  });
});
