import {
  addDays,
  addMonths,
  formatDayKey,
  formatMonthYear,
  isValidDayKey,
  monthCalendarDays,
  monthStartOf,
  parseDayKey,
  rangeDays,
  toDayKey,
  weekDays,
  weekStartOf,
  weekdayLetter,
  weekdayLetters,
  weekdayOf,
} from '../date';

describe('day keys', () => {
  it('round-trips through Date', () => {
    expect(toDayKey(parseDayKey('2026-07-13'))).toBe('2026-07-13');
  });

  it('validates day keys strictly', () => {
    expect(isValidDayKey('2026-07-13')).toBe(true);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-7-3')).toBe(false);
    expect(isValidDayKey('nonsense')).toBe(false);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap year
  });
});

describe('weeks', () => {
  // 2026-07-13 is a Monday.
  it('weekStartOf honors Monday start', () => {
    expect(weekStartOf('2026-07-13', 'monday')).toBe('2026-07-13');
    expect(weekStartOf('2026-07-15', 'monday')).toBe('2026-07-13');
    expect(weekStartOf('2026-07-19', 'monday')).toBe('2026-07-13'); // Sunday belongs to prior week
  });

  it('weekStartOf honors Sunday start', () => {
    expect(weekStartOf('2026-07-13', 'sunday')).toBe('2026-07-12');
    expect(weekStartOf('2026-07-12', 'sunday')).toBe('2026-07-12');
  });

  it('weekDays returns 7 consecutive days', () => {
    const days = weekDays('2026-07-15', 'monday');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-07-13');
    expect(days[6]).toBe('2026-07-19');
  });

  it('weekday indices are JS convention (0=Sun)', () => {
    expect(weekdayOf('2026-07-12')).toBe(0);
    expect(weekdayOf('2026-07-13')).toBe(1);
  });
});

describe('rangeDays', () => {
  it('builds an inclusive range', () => {
    expect(rangeDays('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });

  it('is empty when from > to', () => {
    expect(rangeDays('2026-07-05', '2026-07-01')).toEqual([]);
  });
});

describe('formatDayKey', () => {
  it('labels today/yesterday/tomorrow relative to a reference', () => {
    expect(formatDayKey('2026-07-13', '2026-07-13')).toBe('Today');
    expect(formatDayKey('2026-07-12', '2026-07-13')).toBe('Yesterday');
    expect(formatDayKey('2026-07-14', '2026-07-13')).toBe('Tomorrow');
    expect(formatDayKey('2026-07-01', '2026-07-13')).toBe('Wed, Jul 1');
  });
});

describe('month calendar', () => {
  it('monthStartOf and addMonths', () => {
    expect(monthStartOf('2026-07-14')).toBe('2026-07-01');
    expect(addMonths('2026-07-14', 1)).toBe('2026-08-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('formatMonthYear', () => {
    expect(formatMonthYear('2026-07-14')).toBe('July 2026');
  });

  it('weekdayLetter and weekdayLetters', () => {
    expect(weekdayLetter('2026-07-13')).toBe('M');
    expect(weekdayLetters('monday')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayLetters('sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('monthCalendarDays aligns to week start', () => {
    // July 2026 starts on Wednesday.
    const mon = monthCalendarDays('2026-07-01', 'monday');
    expect(mon).toHaveLength(42);
    expect(mon[0]).toBeNull(); // Mon pad
    expect(mon[1]).toBeNull(); // Tue pad
    expect(mon[2]).toBe('2026-07-01');
    expect(mon[32]).toBe('2026-07-31');

    const sun = monthCalendarDays('2026-07-01', 'sunday');
    expect(sun[0]).toBeNull();
    expect(sun[1]).toBeNull();
    expect(sun[2]).toBeNull();
    expect(sun[3]).toBe('2026-07-01');
  });
});
