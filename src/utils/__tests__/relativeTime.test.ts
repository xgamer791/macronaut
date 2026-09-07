import { relativeTime } from '../relativeTime';

const now = new Date('2026-09-07T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('counts up through seconds, minutes, hours and days', () => {
    expect(relativeTime(ago(5 * SECOND), now)).toBe('Just now');
    expect(relativeTime(ago(59 * SECOND), now)).toBe('Just now');
    expect(relativeTime(ago(MINUTE), now)).toBe('1m ago');
    expect(relativeTime(ago(59 * MINUTE), now)).toBe('59m ago');
    expect(relativeTime(ago(HOUR), now)).toBe('1h ago');
    expect(relativeTime(ago(23 * HOUR), now)).toBe('23h ago');
    expect(relativeTime(ago(DAY), now)).toBe('1d ago');
    expect(relativeTime(ago(6 * DAY), now)).toBe('6d ago');
  });

  it('falls back to a date once a week has passed', () => {
    // "63d ago" tells nobody anything, so older posts show their date.
    expect(relativeTime(ago(7 * DAY), now)).not.toMatch(/ago/);
    expect(relativeTime(ago(60 * DAY), now)).not.toMatch(/ago/);
  });

  it('is empty for a timestamp it cannot read', () => {
    expect(relativeTime('not a date', now)).toBe('');
  });
});
