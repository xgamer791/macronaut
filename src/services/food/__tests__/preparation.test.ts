import {
  detectPreparationState,
  isMeatLike,
  preparationMatchScore,
  preparationMatches,
} from '../preparation';

describe('detectPreparationState', () => {
  it('detects raw / cooked / grilled / roasted / boiled', () => {
    expect(detectPreparationState('Chicken breast, raw')).toBe('raw');
    expect(detectPreparationState('Chicken, cooked, roasted')).toBe('roasted');
    expect(detectPreparationState('Beef steak, grilled')).toBe('grilled');
    expect(detectPreparationState('Egg, boiled')).toBe('boiled');
    expect(detectPreparationState('Ground beef, pan-browned')).toBe('pan_browned');
  });

  it('detects raw even when skinless is also present', () => {
    expect(detectPreparationState('Chicken breast, skinless boneless, raw')).toBe('raw');
    // "braised" is in the boiled/moist-heat family (still cooked, never raw).
    expect(detectPreparationState('Chicken breast, skinless boneless, cooked (braised)')).toBe('boiled');
  });

  it('detects drained / skin variants / lean ratios', () => {
    expect(detectPreparationState('Tuna, canned, drained')).toBe('drained');
    expect(detectPreparationState('Chicken thigh, skinless')).toBe('skinless');
    expect(detectPreparationState('Chicken, skin on')).toBe('skin_on');
    expect(detectPreparationState('Ground beef 90% lean')).toBe('ground_beef_ratio');
    expect(detectPreparationState('Lean turkey')).toBe('lean_percent');
  });

  it('returns unknown when no cue', () => {
    expect(detectPreparationState('Oats')).toBe('unknown');
  });
});

describe('isMeatLike', () => {
  it('detects common meats and seafood', () => {
    expect(isMeatLike('chicken breast')).toBe(true);
    expect(isMeatLike('salmon fillet')).toBe(true);
    expect(isMeatLike('ground beef')).toBe(true);
    expect(isMeatLike('oatmeal')).toBe(false);
  });
});

describe('preparationMatches', () => {
  it('never pairs cooked meat query with raw food', () => {
    expect(preparationMatches('cooked', 'raw', { meatLike: true })).toBe(false);
    expect(preparationMatches('grilled', 'raw', { meatLike: true })).toBe(false);
    expect(preparationMatches('raw', 'roasted', { meatLike: true })).toBe(false);
  });

  it('allows exact and soft cooked-family matches for meats', () => {
    expect(preparationMatches('grilled', 'grilled', { meatLike: true })).toBe(true);
    expect(preparationMatches('cooked', 'roasted', { meatLike: true })).toBe(true);
  });

  it('is softer for non-meat', () => {
    expect(preparationMatches('cooked', 'boiled', { meatLike: false })).toBe(true);
    expect(preparationMatches('unknown', 'raw', { meatLike: false })).toBe(true);
  });

  it('scores exact higher than soft', () => {
    expect(preparationMatchScore('grilled', 'grilled', { meatLike: true })).toBe(1);
    expect(preparationMatchScore('cooked', 'roasted', { meatLike: true })).toBe(0.5);
    expect(preparationMatchScore('raw', 'cooked', { meatLike: true })).toBe(0);
  });
});
