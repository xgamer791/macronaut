import { classifyDay, configForDate, GoalConfig, resolveTargetForDate } from '../goals';
import { NutrientTargets } from '../types';

const base: NutrientTargets = { calories: 2000, protein: 150, carbs: 200, fat: 60 };
const training: NutrientTargets = { calories: 2400, protein: 180, carbs: 260, fat: 65 };
const rest: NutrientTargets = { calories: 1800, protein: 150, carbs: 160, fat: 60 };

function cfg(partial: Partial<GoalConfig>): GoalConfig {
  return {
    id: 'g1',
    effectiveFrom: '2026-01-01',
    mode: 'same-daily',
    baseTarget: base,
    weeklyMode: 'sum-daily',
    ...partial,
  };
}

// 2026-07-06 is a Monday, 2026-07-07 Tuesday, 2026-07-12 Sunday.

describe('resolveTargetForDate', () => {
  it('same-daily always returns baseTarget', () => {
    const c = cfg({});
    expect(resolveTargetForDate('2026-07-06', c)).toEqual(base);
    expect(resolveTargetForDate('2026-07-12', c)).toEqual(base);
  });

  it('per-weekday uses the weekday override, falling back to base', () => {
    const mondayTarget: NutrientTargets = { calories: 2500, protein: 170, carbs: 280, fat: 70 };
    const perWeekday: (NutrientTargets | null)[] = [null, mondayTarget, null, null, null, null, null];
    const c = cfg({ mode: 'per-weekday', perWeekday });
    expect(resolveTargetForDate('2026-07-06', c)).toEqual(mondayTarget); // Monday
    expect(resolveTargetForDate('2026-07-07', c)).toEqual(base); // Tuesday, no override
  });

  it('training-rest uses the weekly pattern', () => {
    const c = cfg({ mode: 'training-rest', training, rest, trainingDays: [1, 3, 5] });
    expect(resolveTargetForDate('2026-07-06', c)).toEqual(training); // Monday
    expect(resolveTargetForDate('2026-07-07', c)).toEqual(rest); // Tuesday
  });

  it('per-date mark overrides the weekly pattern', () => {
    const c = cfg({ mode: 'training-rest', training, rest, trainingDays: [1] });
    // Monday marked rest, Tuesday marked training.
    const marks = { '2026-07-06': 'rest', '2026-07-07': 'training' } as const;
    expect(resolveTargetForDate('2026-07-06', c, marks)).toEqual(rest);
    expect(resolveTargetForDate('2026-07-07', c, marks)).toEqual(training);
  });

  it('training-rest falls back to baseTarget when a type target is missing', () => {
    const c = cfg({ mode: 'training-rest', training, trainingDays: [] });
    expect(resolveTargetForDate('2026-07-07', c)).toEqual(base); // rest day, no rest target
  });
});

describe('classifyDay', () => {
  it('defaults to rest without pattern or mark', () => {
    expect(classifyDay('2026-07-06', cfg({ mode: 'training-rest' }))).toBe('rest');
  });
});

describe('configForDate (effective-dated versioning)', () => {
  const v1 = cfg({ id: 'v1', effectiveFrom: '2026-01-01' });
  const v2 = cfg({
    id: 'v2',
    effectiveFrom: '2026-07-10',
    baseTarget: { calories: 1700, protein: 140, carbs: 150, fat: 55 },
  });

  it('uses the version in effect on the date', () => {
    expect(configForDate('2026-07-09', [v1, v2])?.id).toBe('v1');
    expect(configForDate('2026-07-10', [v1, v2])?.id).toBe('v2');
    expect(configForDate('2026-08-01', [v1, v2])?.id).toBe('v2');
  });

  it('editing goals does not change history: past dates keep old targets', () => {
    const before = resolveTargetForDate('2026-07-09', configForDate('2026-07-09', [v1, v2])!);
    expect(before.calories).toBe(2000);
  });

  it('dates before the first version use the earliest config', () => {
    expect(configForDate('2025-12-01', [v1, v2])?.id).toBe('v1');
  });

  it('returns null with no configs', () => {
    expect(configForDate('2026-01-01', [])).toBeNull();
  });
});
