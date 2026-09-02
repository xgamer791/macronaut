import { describe, expect, it } from 'vitest';
import type { GoalConfig } from '../../src/domain/goals';
import { backend, signedInRepos } from './helpers';

const baseConfig: Omit<GoalConfig, 'id'> = {
  effectiveFrom: '2026-01-01',
  mode: 'same-daily',
  baseTarget: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  weeklyMode: 'sum-daily',
};

describe('goals', () => {
  it('saves and lists effective-dated configs', async () => {
    const { goals } = await signedInRepos(backend());
    await goals.saveConfig({ ...baseConfig, effectiveFrom: '2026-07-10', baseTarget: { calories: 1800 } });
    await goals.saveConfig(baseConfig);
    const configs = await goals.listConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].effectiveFrom).toBe('2026-01-01');
  });

  it('resolves the config in effect for a date', async () => {
    const { goals } = await signedInRepos(backend());
    await goals.saveConfig(baseConfig);
    await goals.saveConfig({ ...baseConfig, effectiveFrom: '2026-07-10', baseTarget: { calories: 1800 } });
    expect((await goals.configFor('2026-07-09'))?.baseTarget.calories).toBe(2000);
    expect((await goals.configFor('2026-07-10'))?.baseTarget.calories).toBe(1800);
  });

  it('same-day re-edit replaces instead of stacking', async () => {
    const { goals } = await signedInRepos(backend());
    await goals.saveConfig({ ...baseConfig, effectiveFrom: '2026-07-10' });
    await goals.saveConfig({ ...baseConfig, effectiveFrom: '2026-07-10', baseTarget: { calories: 1750 } });
    const configs = await goals.listConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].baseTarget.calories).toBe(1750);
  });

  it('keeps training/rest fields and null weekday overrides', async () => {
    const { goals } = await signedInRepos(backend());
    await goals.saveConfig({
      ...baseConfig,
      mode: 'per-weekday',
      perWeekday: [null, { calories: 2200 }, null, null, null, null, null],
      training: { calories: 2450 },
      rest: { calories: 1950 },
      trainingDays: [1, 3, 5],
    });
    const [config] = await goals.listConfigs();
    expect(config.perWeekday?.[1]?.calories).toBe(2200);
    expect(config.perWeekday?.[0]).toBeNull();
    expect(config.trainingDays).toEqual([1, 3, 5]);
  });

  it('sets, reads and clears day-type marks', async () => {
    const { goals } = await signedInRepos(backend());
    await goals.setMark('2026-07-13', 'training');
    await goals.setMark('2026-07-14', 'rest');
    expect(await goals.getMarks('2026-07-13', '2026-07-14')).toEqual({
      '2026-07-13': 'training',
      '2026-07-14': 'rest',
    });
    await goals.setMark('2026-07-13', 'rest');
    expect((await goals.allMarks())['2026-07-13']).toBe('rest');
    await goals.setMark('2026-07-13', null);
    expect(await goals.getMarks('2026-07-13', '2026-07-14')).toEqual({ '2026-07-14': 'rest' });
  });
});
