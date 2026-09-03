/** The native Sign in with Apple path (convex/AppleNative.ts) trusts one thing:
 * a JWT the client hands over. Nothing else guards it — no client secret, no
 * redirect allow-list — so these tests stand in for Apple and check that a token
 * is only believed when every claim holds. Apple's key set is served from a
 * stubbed `fetch`, and the tokens are signed here with a throwaway RS256 pair.
 */
import { SignJWT, exportJWK, generateKeyPair, type JWK, type CryptoKey } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APPLE_NATIVE_AUDIENCE,
  sha256Hex,
  verifyAppleIdentityToken,
} from '../../convex/AppleNative';

const APPLE_ISSUER = 'https://appleid.apple.com';
const KEY_ID = 'test-apple-key';
const SUBJECT = '000123.abcdef0123456789.0001';
const NONCE = 'a-nonce-only-this-client-knows';

let signingKey: CryptoKey;
/** A second pair with the same `kid`, to stand in for a forged signature. */
let impostorKey: CryptoKey;
let nonceHash: string;

interface TokenOverrides {
  audience?: string;
  issuer?: string;
  nonce?: string | null;
  subject?: string | null;
  email?: string;
  expiresIn?: string;
  key?: CryptoKey;
}

async function appleToken(overrides: TokenOverrides = {}): Promise<string> {
  const claims: Record<string, unknown> = {
    email: overrides.email ?? 'ada@privaterelay.appleid.com',
    email_verified: true,
  };
  if (overrides.nonce !== null) claims.nonce = overrides.nonce ?? nonceHash;
  let token = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(overrides.issuer ?? APPLE_ISSUER)
    .setAudience(overrides.audience ?? APPLE_NATIVE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '5m');
  if (overrides.subject !== null) token = token.setSubject(overrides.subject ?? SUBJECT);
  return token.sign(overrides.key ?? signingKey);
}

const realFetch = globalThis.fetch;

beforeAll(async () => {
  const [apple, impostor] = await Promise.all([
    generateKeyPair('RS256', { extractable: true }),
    generateKeyPair('RS256', { extractable: true }),
  ]);
  signingKey = apple.privateKey;
  impostorKey = impostor.privateKey;
  nonceHash = await sha256Hex(NONCE);

  const jwk: JWK = { ...(await exportJWK(apple.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://appleid.apple.com/auth/keys')) {
      return Response.json({ keys: [jwk] });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('Apple identity token verification', () => {
  it('accepts a token Apple signed for this app and this sign-in', async () => {
    await expect(verifyAppleIdentityToken(await appleToken(), NONCE)).resolves.toEqual({
      subject: SUBJECT,
      email: 'ada@privaterelay.appleid.com',
    });
  });

  it('refuses a token signed by anyone but Apple', async () => {
    const forged = await appleToken({ key: impostorKey });
    await expect(verifyAppleIdentityToken(forged, NONCE)).rejects.toThrow();
  });

  it('refuses a token issued for a different app', async () => {
    const other = await appleToken({ audience: 'com.someone-else.app' });
    await expect(verifyAppleIdentityToken(other, NONCE)).rejects.toThrow(/"aud" claim/);
  });

  it('refuses a token from an issuer pretending to be Apple', async () => {
    const other = await appleToken({ issuer: 'https://appleid.apple.com.evil.example' });
    await expect(verifyAppleIdentityToken(other, NONCE)).rejects.toThrow(/"iss" claim/);
  });

  it('refuses an expired token', async () => {
    const stale = await appleToken({ expiresIn: '-1m' });
    await expect(verifyAppleIdentityToken(stale, NONCE)).rejects.toThrow(/exp/i);
  });

  it('refuses a token replayed against a different sign-in attempt', async () => {
    const token = await appleToken();
    await expect(verifyAppleIdentityToken(token, 'some other nonce')).rejects.toThrow(
      /sign-in attempt/,
    );
  });

  it('refuses a token with no nonce at all', async () => {
    const token = await appleToken({ nonce: null });
    await expect(verifyAppleIdentityToken(token, NONCE)).rejects.toThrow(/sign-in attempt/);
  });

  it('accepts a token with no email, which Apple omits after the first consent', async () => {
    // Apple returns the address on every native sign-in today, but the account
    // is keyed on `sub`, so a token without one must still sign the person in.
    const token = await new SignJWT({ nonce: nonceHash })
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(APPLE_ISSUER)
      .setAudience(APPLE_NATIVE_AUDIENCE)
      .setSubject(SUBJECT)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);
    await expect(verifyAppleIdentityToken(token, NONCE)).resolves.toEqual({ subject: SUBJECT });
  });
});
