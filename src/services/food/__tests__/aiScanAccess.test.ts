import { canUseAiFoodScan, normalizeEmail } from '../../../../convex/lib/aiScanAccess';

describe('canUseAiFoodScan', () => {
  it('allows the owner and partner accounts, ignoring case and spaces', () => {
    expect(canUseAiFoodScan('lifewirecg@gmail.com')).toBe(true);
    expect(canUseAiFoodScan('salonnewvine@gmail.com')).toBe(true);
    expect(canUseAiFoodScan(' LifeWireCG@gmail.com ')).toBe(true);
    expect(canUseAiFoodScan('SalonNewVine@Gmail.com')).toBe(true);
  });

  it('refuses everyone else, including empty values', () => {
    expect(canUseAiFoodScan('someone@example.com')).toBe(false);
    expect(canUseAiFoodScan('lifewirecg@gmail.com.evil')).toBe(false);
    expect(canUseAiFoodScan('')).toBe(false);
    expect(canUseAiFoodScan(null)).toBe(false);
    expect(canUseAiFoodScan(undefined)).toBe(false);
  });

  it('allows if any of several emails matches', () => {
    expect(canUseAiFoodScan('other@example.com', 'lifewirecg@gmail.com')).toBe(true);
    expect(canUseAiFoodScan('other@example.com', 'nope@example.com')).toBe(false);
  });

  it('normalizes email for comparison', () => {
    expect(normalizeEmail('  A@B.com ')).toBe('a@b.com');
  });
});
