import { dayProgress, weekProgress } from '../aggregation';
import { GoalConfig } from '../goals';
import { Nutrition, NutrientTargets } from '../types';
import { weekDays } from '@/utils/date';

const base: NutrientTargets = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

const config: GoalConfig = {
  id: 'g',
  effectiveFrom: '2026-01-01',
  mode: 'same-daily',
  baseTarget: base,
  weeklyMode: 'sum-daily',
};

const meal = (cal: number, protein = 0): Nutrition => ({ calories: cal, protein });

describe('dayProgress', () => {
  it('computes consumed, remaining and over state', () => {
    const p = dayProgress('2026-07-06', [meal(600), meal(500)], config);
    expect(p.consumed.calories).toBe(1100);
    expect(p.burned).toBe(0);
    expect(p.caloriesRemaining).toBe(900);
    expect(p.overCalories).toBe(false);
  });

  it('flags over-target days with negative remaining', () => {
    const p = dayProgress('2026-07-06', [meal(2500)], config);
    expect(p.caloriesRemaining).toBe(-500);
    expect(p.overCalories).toBe(true);
  });

  it('credits exercise burn toward remaining calories', () => {
    const p = dayProgress('2026-07-06', [meal(2200)], config, {}, 400);
    expect(p.burned).toBe(400);
    expect(p.netCalories).toBe(1800);
    expect(p.caloriesRemaining).toBe(200);
    expect(p.overCalories).toBe(false);
  });
});

describe('weekProgress', () => {
  // Week of Mon 2026-07-06 (weekStart monday).
  const days = weekDays('2026-07-08', 'monday');

  it('sums the 7 daily targets in sum-daily mode — no rollover between days', () => {
    const p = weekProgress(days, { '2026-07-06': [meal(1500)] }, config);
    expect(p.weeklyTarget.calories).toBe(2000 * 7);
    expect(p.weeklyConsumed.calories).toBe(1500);
    expect(p.weeklyRemaining).toBe(14000 - 1500);
    // The 500 unused kcal on Monday must NOT raise any other day's target.
    for (const d of p.days) expect(d.target.calories).toBe(2000);
  });

  it('uses the explicit weekly target in custom mode', () => {
    const custom: GoalConfig = {
      ...config,
      weeklyMode: 'custom',
      weeklyTarget: { calories: 13000, protein: 1000 },
    };
    const p = weekProgress(days, {}, custom);
    expect(p.weeklyTarget.calories).toBe(13000);
  });

  it('counts days over/under and computes adherence over logged days only', () => {
    const p = weekProgress(
      days,
      {
        '2026-07-06': [meal(1900)], // under
        '2026-07-07': [meal(2100)], // over
        '2026-07-08': [meal(2000)], // exactly at target = not over
      },
      config,
    );
    expect(p.daysLogged).toBe(3);
    expect(p.daysOverCalories).toBe(1);
    expect(p.daysUnderCalories).toBe(2);
    expect(p.calorieAdherence).toBeCloseTo(2 / 3);
  });

  it('averages per day over logged days', () => {
    const p = weekProgress(
      days,
      { '2026-07-06': [meal(1000)], '2026-07-07': [meal(2000)] },
      config,
    );
    expect(p.averagePerDay.calories).toBe(1500);
  });

  it('computes per-macro adherence', () => {
    const p = weekProgress(
      days,
      {
        '2026-07-06': [{ calories: 1500, protein: 140 }], // within protein
        '2026-07-07': [{ calories: 1500, protein: 160 }], // over protein
      },
      config,
    );
    expect(p.macroAdherence.protein).toBeCloseTo(0.5);
  });

  it('handles an empty week', () => {
    const p = weekProgress(days, {}, config);
    expect(p.daysLogged).toBe(0);
    expect(p.calorieAdherence).toBe(0);
    expect(p.averagePerDay.calories).toBe(0);
  });
});
