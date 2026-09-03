import { appleDisplayName, createAppleNonce, supportsNativeAppleAuth } from '../apple';
import { displayNameFromUser } from '../displayName';
import { isPlausibleEmail, normalizeEmail } from '../email';
import { webRedirectUrl } from '../redirect';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `https://app.test${path}` }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (length: number) => new Uint8Array(length).fill(0xab),
  digestStringAsync: async (_algorithm: string, value: string) => `hashed:${value}`,
}));

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

describe('Sign in with Apple', () => {
  it('joins whichever halves of the name Apple shared', () => {
    expect(appleDisplayName({ givenName: 'Ada', familyName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(appleDisplayName({ givenName: ' Ada ', familyName: null })).toBe('Ada');
    expect(appleDisplayName({ givenName: null, familyName: 'Lovelace' })).toBe('Lovelace');
  });

  it('returns nothing when Apple withheld the name, as it does after first consent', () => {
    expect(appleDisplayName(null)).toBeUndefined();
    expect(appleDisplayName(undefined)).toBeUndefined();
    expect(appleDisplayName({ givenName: '  ', familyName: null })).toBeUndefined();
  });

  it('caps the name like every other provider-supplied one', () => {
    expect(appleDisplayName({ givenName: 'x'.repeat(100) })).toHaveLength(60);
  });

  it('sends Apple the hash and keeps the pre-image for our backend', async () => {
    const nonce = await createAppleNonce();
    expect(nonce.raw).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.hashed).toBe(`hashed:${nonce.raw}`);
  });

  it('uses the browser flow off iOS, where Apple has no native sheet', () => {
    expect(supportsNativeAppleAuth()).toBe(false);
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
