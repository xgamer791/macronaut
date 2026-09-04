import { displayNameFromUser } from '../displayName';
import { isPlausibleEmail, normalizeEmail } from '../email';
import { expoRouterPathFromLocationUrl } from '../redirect';

describe('expoRouterPathFromLocationUrl', () => {
  it('strips the GitHub Pages base path so Expo Router sees an app-relative URL', () => {
    expect(expoRouterPathFromLocationUrl('/macronaut/', '/macronaut')).toBe('/');
    expect(expoRouterPathFromLocationUrl('/macronaut', '/macronaut')).toBe('/');
    expect(expoRouterPathFromLocationUrl('/macronaut/login', '/macronaut')).toBe('/login');
    expect(expoRouterPathFromLocationUrl('/macronaut/?foo=1', '/macronaut')).toBe('/?foo=1');
    expect(expoRouterPathFromLocationUrl('/macronaut?foo=1', '/macronaut')).toBe('/?foo=1');
  });

  it('leaves paths alone when there is no base path', () => {
    expect(expoRouterPathFromLocationUrl('/login', '')).toBe('/login');
    expect(expoRouterPathFromLocationUrl('/?code=', undefined)).toBe('/?code=');
    expect(expoRouterPathFromLocationUrl('login', undefined)).toBe('/login');
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
