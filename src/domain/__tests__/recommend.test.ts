import { recommendTargets } from '../recommend';
import { caloriesFromMacros } from '../nutrition';

describe('recommendTargets (Mifflin-St Jeor)', () => {
  const male = {
    age: 30,
    sex: 'male' as const,
    height: 180,
    weight: 80,
    activity: 'moderate' as const,
    goalType: 'maintain' as const,
  };

  it('computes BMR per Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(recommendTargets(male).bmr).toBe(1780);
  });

  it('applies the activity multiplier', () => {
    expect(recommendTargets(male).tdee).toBe(Math.round(1780 * 1.55));
  });

  it('female offset is -161', () => {
    const r = recommendTargets({ ...male, sex: 'female' });
    // 800 + 1125 - 150 - 161 = 1614
    expect(r.bmr).toBe(1614);
  });

  it('losing weight sets a deficit from the weekly rate', () => {
    const r = recommendTargets({ ...male, goalType: 'lose', weeklyRateKg: -0.5 });
    const expected = Math.round(1780 * 1.55 + (-0.5 * 7700) / 7);
    expect(r.targets.calories).toBe(expected);
  });

  it('never recommends below 1200 kcal', () => {
    const r = recommendTargets({
      age: 60,
      sex: 'female',
      height: 150,
      weight: 45,
      activity: 'sedentary',
      goalType: 'lose',
      weeklyRateKg: -1,
    });
    expect(r.targets.calories).toBe(1200);
  });

  it('macros approximately add back to the calorie target', () => {
    const { targets } = recommendTargets(male);
    const kcal = caloriesFromMacros(targets.protein!, targets.carbs!, targets.fat!);
    expect(Math.abs(kcal - targets.calories)).toBeLessThan(20); // rounding drift only
  });

  it('muscle goal biases protein to 2 g/kg', () => {
    const r = recommendTargets({ ...male, goalType: 'muscle' });
    expect(r.targets.protein).toBe(160);
  });
});
