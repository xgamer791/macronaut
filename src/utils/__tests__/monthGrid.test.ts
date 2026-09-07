import {
  monthGridDays,
  monthLabel,
  monthNames,
  monthOf,
  weekdayShortLabels,
  withMonth,
  withYear,
  yearOf,
} from '@/utils/date';

describe('monthGridDays', () => {
  it('always fills six weeks so the grid never changes height', () => {
    for (const month of ['2026-02-01', '2026-06-01', '2026-08-01', '2027-01-01']) {
      expect(monthGridDays(month, 'monday')).toHaveLength(42);
      expect(monthGridDays(month, 'sunday')).toHaveLength(42);
    }
  });

  it('runs one unbroken sequence of days, neighbouring months included', () => {
    const cells = monthGridDays('2026-06-01', 'monday');
    // June 2026 opens on a Monday, so the month owns the first 30 cells and
    // July fills the remaining twelve rather than leaving them blank.
    expect(cells[0]).toEqual({ key: '2026-06-01', inMonth: true });
    expect(cells[29]).toEqual({ key: '2026-06-30', inMonth: true });
    expect(cells[30]).toEqual({ key: '2026-07-01', inMonth: false });
    expect(cells[41]).toEqual({ key: '2026-07-12', inMonth: false });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it('spills the previous month into the leading cells', () => {
    const cells = monthGridDays('2026-09-01', 'monday');
    // September 2026 opens on a Tuesday.
    expect(cells[0]).toEqual({ key: '2026-08-31', inMonth: false });
    expect(cells[1]).toEqual({ key: '2026-09-01', inMonth: true });
  });

  it('honours the week-start preference', () => {
    expect(monthGridDays('2026-09-01', 'sunday')[0].key).toBe('2026-08-30');
    expect(monthGridDays('2026-09-01', 'monday')[0].key).toBe('2026-08-31');
  });
});

describe('month and year helpers', () => {
  it('labels the weekday row three letters wide, in week-start order', () => {
    expect(weekdayShortLabels('monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(weekdayShortLabels('sunday')[0]).toBe('Sun');
  });

  it('reads the month and year off a day key', () => {
    expect(monthLabel('2026-06-30')).toBe('June');
    expect(monthOf('2026-06-30')).toBe(5);
    expect(yearOf('2026-06-30')).toBe(2026);
    expect(monthNames).toHaveLength(12);
    expect(monthNames[0]).toBe('January');
  });

  it('jumps to the first of a picked month or year', () => {
    expect(withMonth('2026-06-30', 0)).toBe('2026-01-01');
    expect(withYear('2026-06-30', 2024)).toBe('2024-06-01');
    // A short target month cannot inherit a day that does not exist in it.
    expect(withMonth('2026-01-31', 1)).toBe('2026-02-01');
  });
});
