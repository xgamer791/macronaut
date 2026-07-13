import { createTestDb } from '@/db/__tests__/testDb';
import { GoalConfig } from '@/domain/goals';
import { createGoalRepo, GoalRepo } from '../goalRepo';

const baseConfig: Omit<GoalConfig, 'id'> = {
  effectiveFrom: '2026-01-01',
  mode: 'same-daily',
  baseTarget: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  weeklyMode: 'sum-daily',
};

describe('goalRepo', () => {
  let repo: GoalRepo;

  beforeEach(async () => {
    repo = createGoalRepo(await createTestDb());
  });

  it('saves and lists effective-dated configs', async () => {
    await repo.saveConfig(baseConfig);
    await repo.saveConfig({
      ...baseConfig,
      effectiveFrom: '2026-07-10',
      baseTarget: { calories: 1800 },
    });
    const configs = await repo.listConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].effectiveFrom).toBe('2026-01-01');
  });

  it('resolves the config in effect for a date', async () => {
    await repo.saveConfig(baseConfig);
    await repo.saveConfig({
      ...baseConfig,
      effectiveFrom: '2026-07-10',
      baseTarget: { calories: 1800 },
    });
    expect((await repo.configFor('2026-07-09'))?.baseTarget.calories).toBe(2000);
    expect((await repo.configFor('2026-07-10'))?.baseTarget.calories).toBe(1800);
  });

  it('same-day re-edit replaces instead of stacking', async () => {
    await repo.saveConfig({ ...baseConfig, effectiveFrom: '2026-07-10' });
    await repo.saveConfig({
      ...baseConfig,
      effectiveFrom: '2026-07-10',
      baseTarget: { calories: 1750 },
    });
    const configs = await repo.listConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].baseTarget.calories).toBe(1750);
  });

  it('sets, reads and clears day-type marks', async () => {
    await repo.setMark('2026-07-13', 'training');
    await repo.setMark('2026-07-14', 'rest');
    expect(await repo.getMarks('2026-07-13', '2026-07-14')).toEqual({
      '2026-07-13': 'training',
      '2026-07-14': 'rest',
    });
    await repo.setMark('2026-07-13', null);
    expect(await repo.getMarks('2026-07-13', '2026-07-14')).toEqual({ '2026-07-14': 'rest' });
  });
});
