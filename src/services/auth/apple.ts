import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/** Apple's native sheet exists on iOS only. Everywhere else — web, Android —
 * Sign in with Apple is the same browser OAuth round trip Google uses. */
export function supportsNativeAppleAuth(): boolean {
  return Platform.OS === 'ios';
}

export interface AppleNonce {
  /** Kept on the device and sent to our backend, never to Apple. */
  raw: string;
  /** Sent to Apple, which copies it into the identity token verbatim. */
  hashed: string;
}

const NONCE_BYTES = 32;

/** Apple echoes the request nonce into the identity token, so sending Apple the
 * hash and our backend the raw value means the token alone is not enough to
 * prove it was minted for this sign-in: whoever presents it must also know the
 * pre-image. `convex/AppleNative.ts` hashes the raw value and compares. */
export async function createAppleNonce(): Promise<AppleNonce> {
  const raw = Array.from(Crypto.getRandomBytes(NONCE_BYTES), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export interface AppleFullName {
  givenName?: string | null;
  familyName?: string | null;
}

/** Apple shares the name only on the very first consent, and the person can
 * withhold either half of it, so both parts are optional. Capped like every
 * other provider-supplied name (`displayNameFromUser`). */
export function appleDisplayName(fullName: AppleFullName | null | undefined): string | undefined {
  const parts = [fullName?.givenName, fullName?.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  if (parts.length === 0) return undefined;
  return parts.join(' ').slice(0, 60);
}
