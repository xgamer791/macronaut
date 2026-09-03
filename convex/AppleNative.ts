import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import { createAccount } from '@convex-dev/auth/server';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { DataModel } from './_generated/dataModel';

/** Accounts are written under the same provider id the web OAuth flow uses
 * (convex/auth.ts), so one Apple ID is one Macronaut account whether the person
 * signed in through Apple's native sheet on iOS or through the browser. */
export const APPLE_PROVIDER_ID = 'apple';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

/** Native identity tokens are addressed to the App ID (app.config.ts →
 * `ios.bundleIdentifier`); the web flow's tokens are addressed to the Services
 * ID in `AUTH_APPLE_ID` instead. Both are public identifiers, so this one is a
 * constant with an override for the day the bundle id changes. */
export const APPLE_NATIVE_AUDIENCE =
  process.env.AUTH_APPLE_NATIVE_ID ?? 'com.mangomarketeers.macronaut';

/** Names longer than this are truncated, matching `displayNameFromUser`. */
const NAME_MAX = 60;

const appleKeys = createRemoteJWKSet(APPLE_JWKS_URL);

/** Lowercase hex, which is what `expo-crypto`'s `digestStringAsync` produces on
 * the client, so the two sides can be compared as strings. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface AppleIdentity {
  /** Apple's stable per-team user id, used as the account's provider id. */
  subject: string;
  /** Real address, or a `@privaterelay.appleid.com` one if the user hid theirs.
   * Apple only ever returns addresses it has verified. */
  email?: string;
}

/**
 * The claim checks `jwtVerify` does not make for us. Signature, issuer,
 * audience and expiry are already enforced by the caller; what is left is that
 * the token identifies somebody and that it was minted for the sign-in attempt
 * in front of us rather than replayed from somewhere else.
 */
export function appleIdentityFromClaims(claims: JWTPayload, nonceHash: string): AppleIdentity {
  const subject = typeof claims.sub === 'string' ? claims.sub.trim() : '';
  if (!subject) throw new Error('Apple identity token does not identify a user');
  if (typeof claims.nonce !== 'string' || claims.nonce !== nonceHash) {
    throw new Error('Apple identity token does not belong to this sign-in attempt');
  }
  const email =
    typeof claims.email === 'string' && claims.email.includes('@') ? claims.email : undefined;
  return { ...(email ? { email } : null), subject };
}

/**
 * Turns the identity token Apple's sheet returned into the account it stands
 * for, or throws. A token is only believed if Apple signed it with a key it
 * publishes, it names Apple as its issuer, it was issued for this app rather
 * than some other one, it has not expired, and its `nonce` is the SHA-256 of the
 * nonce this client kept to itself — so a token captured elsewhere cannot be
 * replayed here. Everything needed to check that is public, which is why this
 * path has no secret to configure or rotate.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  nonce: string,
): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(identityToken, appleKeys, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: APPLE_NATIVE_AUDIENCE,
  });
  return appleIdentityFromClaims(payload, await sha256Hex(nonce));
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Apple sign-in is missing \`${field}\``);
  }
  return value;
}

/**
 * Sign in with Apple on iOS, where Apple's own sheet (Face ID, no browser) is
 * what the platform and App Store review expect. The sheet returns an identity
 * token signed by Apple; this provider verifies it against Apple's published
 * keys and then signs the person in through Convex Auth exactly as the OAuth
 * callback would.
 *
 * Web and Android use the OAuth `apple` provider in convex/auth.ts instead.
 */
export const AppleNative = ConvexCredentials<DataModel>({
  id: 'apple-native',

  authorize: async (credentials, ctx) => {
    const identityToken = requireString(credentials.identityToken, 'identityToken');
    const nonce = requireString(credentials.nonce, 'nonce');
    const name =
      typeof credentials.name === 'string' && credentials.name.trim().length > 0
        ? credentials.name.trim().slice(0, NAME_MAX)
        : undefined;

    const identity = await verifyAppleIdentityToken(identityToken, nonce);

    // `createAccount` returns the existing account untouched when there is one,
    // which is what we want: Apple shares the name only on first consent, so
    // the value stored then must survive every later sign-in.
    const { user } = await createAccount(ctx, {
      provider: APPLE_PROVIDER_ID,
      account: { id: identity.subject },
      profile: {
        ...(identity.email ? { email: identity.email } : null),
        ...(name ? { name } : null),
      },
      shouldLinkViaEmail: identity.email !== undefined,
    });
    return { userId: user._id };
  },
});
