import { describe, expect, it } from 'vitest';
import { APPLE_PROVIDER_ID, appleIdentityFromClaims, sha256Hex } from '../../convex/AppleNative';
import { randomDigits } from '../../convex/ResendOTP';
import { isAllowedRedirect } from '../../convex/auth';

describe('OAuth redirect allow-list', () => {
  const site = 'https://xgamer791.github.io/macronaut';

  it('allows the deployed site, the native scheme and dev URLs', () => {
    expect(isAllowedRedirect(`${site}/`, site)).toBe(true);
    expect(isAllowedRedirect('macronaut://', site)).toBe(true);
    expect(isAllowedRedirect('exp://192.168.1.20:8081/--/', site)).toBe(true);
    expect(isAllowedRedirect('http://localhost:8081/', site)).toBe(true);
  });

  it('refuses anything else, including look-alike hosts', () => {
    expect(isAllowedRedirect('https://evil.example/', site)).toBe(false);
    expect(isAllowedRedirect('https://xgamer791.github.io.evil.example/macronaut/', site)).toBe(false);
    expect(isAllowedRedirect('http://localhost.evil.example/', site)).toBe(false);
    expect(isAllowedRedirect('https://xgamer791.github.io/macronaut/', undefined)).toBe(false);
  });
});

describe('email code generation', () => {
  it('produces the requested number of digits only', () => {
    for (let i = 0; i < 50; i += 1) expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });
});

describe('native Sign in with Apple', () => {
  /** SHA-256 of "nonce", lowercase hex, which is the form expo-crypto produces. */
  const NONCE_HASH = '78377b525757b494427f89014f97d79928f3938d14eb51e20fb5dec9834eb304';

  it('hashes the nonce the same way the client does', async () => {
    expect(await sha256Hex('nonce')).toBe(NONCE_HASH);
  });

  it('accepts a token whose nonce matches the sign-in attempt', () => {
    expect(
      appleIdentityFromClaims(
        { sub: '000123.abc.0001', email: 'ada@privaterelay.appleid.com', nonce: NONCE_HASH },
        NONCE_HASH,
      ),
    ).toEqual({ subject: '000123.abc.0001', email: 'ada@privaterelay.appleid.com' });
  });

  it('accepts a token with no email, which Apple omits after first consent', () => {
    expect(
      appleIdentityFromClaims({ sub: '000123.abc.0001', nonce: NONCE_HASH }, NONCE_HASH),
    ).toEqual({ subject: '000123.abc.0001' });
  });

  it('refuses a token minted for a different sign-in attempt', () => {
    expect(() =>
      appleIdentityFromClaims({ sub: '000123.abc.0001', nonce: 'someone else' }, NONCE_HASH),
    ).toThrow(/sign-in attempt/);
    expect(() => appleIdentityFromClaims({ sub: '000123.abc.0001' }, NONCE_HASH)).toThrow(
      /sign-in attempt/,
    );
  });

  it('refuses a token that identifies nobody', () => {
    expect(() => appleIdentityFromClaims({ nonce: NONCE_HASH }, NONCE_HASH)).toThrow(
      /identify a user/,
    );
    expect(() => appleIdentityFromClaims({ sub: '  ', nonce: NONCE_HASH }, NONCE_HASH)).toThrow(
      /identify a user/,
    );
  });

  it('writes to the same accounts as the web OAuth flow, so one Apple ID is one user', () => {
    expect(APPLE_PROVIDER_ID).toBe('apple');
  });
});
