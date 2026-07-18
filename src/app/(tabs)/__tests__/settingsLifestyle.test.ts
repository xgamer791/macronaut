import { ActivityLevel } from '@/domain/types';

/** Mirrors Settings nutrition-style ↔ goalType mapping used by the lifestyle UI. */
const STYLE_TO_GOAL = {
  cut: 'lose',
  maintain: 'maintain',
  bulk: 'gain',
} as const;

const GOAL_TO_STYLE: Record<string, keyof typeof STYLE_TO_GOAL> = {
  lose: 'cut',
  maintain: 'maintain',
  gain: 'bulk',
  muscle: 'bulk',
};

const ACTIVITY_OPTIONS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very',
  'extra',
];

describe('settings lifestyle mappings', () => {
  it('maps Cut/Maintain/Bulk to goal types', () => {
    expect(STYLE_TO_GOAL.cut).toBe('lose');
    expect(STYLE_TO_GOAL.maintain).toBe('maintain');
    expect(STYLE_TO_GOAL.bulk).toBe('gain');
  });

  it('maps goal types back to nutrition style', () => {
    expect(GOAL_TO_STYLE.lose).toBe('cut');
    expect(GOAL_TO_STYLE.muscle).toBe('bulk');
  });

  it('includes full activity effort levels', () => {
    expect(ACTIVITY_OPTIONS).toHaveLength(5);
    expect(ACTIVITY_OPTIONS).toContain('moderate');
    expect(ACTIVITY_OPTIONS).toContain('extra');
  });

  it('clamps water cups into a sane range', () => {
    const clamp = (n: number) => Math.max(1, Math.min(16, n));
    expect(clamp(0)).toBe(1);
    expect(clamp(8)).toBe(8);
    expect(clamp(20)).toBe(16);
  });

  it('steps step goals in 500s within bounds', () => {
    const clamp = (n: number) => Math.max(1000, Math.min(30000, Math.round(n / 500) * 500));
    expect(clamp(9700)).toBe(9500);
    expect(clamp(10200)).toBe(10000);
    expect(clamp(50)).toBe(1000);
  });
});
