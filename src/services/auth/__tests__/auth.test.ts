import { displayNameFromUser } from '../displayName';
import { isPlausibleEmail, normalizeEmail } from '../email';
import { webRedirectUrl } from '../redirect';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `https://app.test${path}` }));

describe('webRedirectUrl', () => {
  it('keeps the base path the GitHub Pages build is served from', () => {
    expect(webRedirectUrl('https://xgamer791.github.io', '/macronaut')).toBe(
      'https://xgamer791.github.io/macronaut/',
    );
  });

  it('returns the origin root when there is no base path', () => {
    expect(webRedirectUrl('http://localhost:8081', '')).toBe('http://localhost:8081/');
    expect(webRedirectUrl('http://localhost:8081', undefined)).toBe('http://localhost:8081/');
  });

  it('normalises stray slashes on either side', () => {
    expect(webRedirectUrl('https://example.com/', 'macronaut/')).toBe(
      'https://example.com/macronaut/',
    );
    expect(webRedirectUrl('https://example.com', '/macronaut/')).toBe(
      'https://example.com/macronaut/',
    );
    expect(webRedirectUrl('https://example.com', '/')).toBe('https://example.com/');
  });

  it('handles a nested base path', () => {
    expect(webRedirectUrl('https://example.com', '/apps/macronaut')).toBe(
      'https://example.com/apps/macronaut/',
    );
  });
});

describe('email normalisation', () => {
  it('lowercases and trims so one address is one account', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('accepts addresses that can plausibly receive a code', () => {
    expect(isPlausibleEmail('person@example.com')).toBe(true);
    expect(isPlausibleEmail(' Person@Example.co ')).toBe(true);
  });

  it('rejects addresses that cannot', () => {
    expect(isPlausibleEmail('@')).toBe(false);
    expect(isPlausibleEmail('person@')).toBe(false);
    expect(isPlausibleEmail('person@example')).toBe(false);
    expect(isPlausibleEmail('person example@test.com')).toBe(false);
    expect(isPlausibleEmail('')).toBe(false);
  });
});

describe('displayNameFromUser', () => {
  it('prefers the provider name, trimmed and capped', () => {
    expect(displayNameFromUser({ id: 'u', name: '  Ada Lovelace  ', email: 'ada@example.com' })).toBe(
      'Ada Lovelace',
    );
    expect(displayNameFromUser({ id: 'u', name: 'x'.repeat(100) })).toHaveLength(60);
  });

  it('falls back to a capitalised email local part', () => {
    expect(displayNameFromUser({ id: 'u', email: 'ada@example.com' })).toBe('Ada');
  });

  it('returns nothing for a missing user or a user with no email', () => {
    expect(displayNameFromUser(null)).toBeUndefined();
    expect(displayNameFromUser({ id: 'u' })).toBeUndefined();
  });
});
