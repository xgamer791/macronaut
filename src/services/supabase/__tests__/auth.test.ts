/* eslint-disable import/first -- jest.mock factories must be declared before the module under test is imported. */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `https://app.test${path}` }));

import type { Session } from '@supabase/supabase-js';
import {
  displayNameFromSession,
  isPlausibleEmail,
  normalizeEmail,
  providerFromSession,
  webRedirectUrl,
} from '../auth';

function session(overrides: {
  email?: string;
  userMetadata?: Record<string, unknown>;
  provider?: string;
}): Session {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
      email: overrides.email,
      app_metadata: overrides.provider ? { provider: overrides.provider } : {},
      user_metadata: overrides.userMetadata ?? {},
    },
  } as unknown as Session;
}

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

  it('rejects addresses the old check let through', () => {
    expect(isPlausibleEmail('@')).toBe(false);
    expect(isPlausibleEmail('person@')).toBe(false);
    expect(isPlausibleEmail('person@example')).toBe(false);
    expect(isPlausibleEmail('person example@test.com')).toBe(false);
    expect(isPlausibleEmail('')).toBe(false);
  });
});

describe('displayNameFromSession', () => {
  it('prefers the provider full name', () => {
    expect(displayNameFromSession(session({ userMetadata: { full_name: 'Ada Lovelace' } }))).toBe(
      'Ada Lovelace',
    );
  });

  it('falls back to the email local part, capitalised', () => {
    expect(displayNameFromSession(session({ email: 'ada@example.com' }))).toBe('Ada');
  });

  it('caps provider-supplied names, which are user-controlled text', () => {
    const name = displayNameFromSession(
      session({ userMetadata: { full_name: 'A'.repeat(500) } }),
    );
    expect(name).toHaveLength(60);
  });

  it('ignores non-string metadata', () => {
    expect(
      displayNameFromSession(session({ userMetadata: { full_name: { evil: true } }, email: 'z@x.io' })),
    ).toBe('Z');
  });

  it('returns undefined without a session', () => {
    expect(displayNameFromSession(null)).toBeUndefined();
  });
});

describe('providerFromSession', () => {
  it('reads the sign-in provider', () => {
    expect(providerFromSession(session({ provider: 'google' }))).toBe('google');
    expect(providerFromSession(session({ provider: 'email' }))).toBe('email');
  });

  it('does not guess at providers it does not handle', () => {
    expect(providerFromSession(session({ provider: 'github' }))).toBeUndefined();
    expect(providerFromSession(null)).toBeUndefined();
  });
});
