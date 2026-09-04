import { displayNameFromUser } from '../displayName';
import { isPlausibleEmail, normalizeEmail } from '../email';
import { passwordResetFromParams } from '../passwordReset';
import { expoRouterPathFromLocationUrl, shouldHandleAuthCodeFromUrl } from '../redirect';

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

describe('shouldHandleAuthCodeFromUrl', () => {
  it('leaves OAuth and magic-link codes alone on every other path', () => {
    expect(shouldHandleAuthCodeFromUrl('/')).toBe(true);
    expect(shouldHandleAuthCodeFromUrl('/login')).toBe(true);
    expect(shouldHandleAuthCodeFromUrl('/macronaut/')).toBe(true);
    expect(shouldHandleAuthCodeFromUrl('/macronaut/login?code=abc')).toBe(true);
  });

  it('refuses to consume a code on the password-reset page', () => {
    expect(shouldHandleAuthCodeFromUrl('/forgot-password')).toBe(false);
    expect(shouldHandleAuthCodeFromUrl('/forgot-password/')).toBe(false);
    expect(shouldHandleAuthCodeFromUrl('/macronaut/forgot-password')).toBe(false);
    expect(shouldHandleAuthCodeFromUrl('/macronaut/forgot-password?token=abc')).toBe(false);
  });
});

describe('passwordResetFromParams', () => {
  const token = 'a'.repeat(64);

  it('opens the new-password fields only when the emailed link is complete', () => {
    expect(passwordResetFromParams({ email: 'Person@Example.com', token })).toEqual({
      email: 'Person@Example.com',
      token,
    });
    expect(passwordResetFromParams({ email: ['ada@example.com'], token: [token] })).toEqual({
      email: 'ada@example.com',
      token,
    });
  });

  it('stays on the request form without a real token or address', () => {
    expect(passwordResetFromParams({ email: 'ada@example.com' })).toBeNull();
    expect(passwordResetFromParams({ token })).toBeNull();
    expect(passwordResetFromParams({ email: 'ada@example.com', token: '123456' })).toBeNull();
    expect(passwordResetFromParams({ email: 'not-an-email', token })).toBeNull();
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
    expect(
      displayNameFromUser({ id: 'u', name: '  Ada Lovelace  ', email: 'ada@example.com' }),
    ).toBe('Ada Lovelace');
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
