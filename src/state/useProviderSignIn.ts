import { useAuthActions } from '@convex-dev/auth/react';
// Type-only, so the iOS-only module is erased from the web and Android bundles;
// the value is `require`d in `signInWithApple`, on iOS only.
import type * as AppleAuth from 'expo-apple-authentication';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  appleDisplayName,
  createAppleNonce,
  supportsNativeAppleAuth,
} from '@/services/auth/apple';
import { normalizeEmail } from '@/services/auth/email';
import { friendlyAuthError } from '@/services/auth/errors';
import { authRedirectUrl } from '@/services/auth/redirect';

/** Apple's own sheet reports a dismissal as an error rather than a result. */
const APPLE_CANCELLED = 'ERR_REQUEST_CANCELED';

export interface ProviderSignIn {
  /** A sign-in is in flight; every control should be disabled. */
  busy: boolean;
  /** Last failure, already turned into something a person can act on. */
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  /** Emails a six-digit code. Resolves true when it was sent. */
  sendEmailCode: (email: string) => Promise<boolean>;
  /** Exchanges the code for a session. On success AuthProvider publishes the
   * session and the screen redirects itself. */
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
}

/** Every way into the app, shared by the login and create-account screens.
 * Nothing here knows which of the two it is running on. */
export function useProviderSignIn(): ProviderSignIn {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(friendlyAuthError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // The consent screen runs against the Convex site URL, which holds the client
  // secret. On web the browser is redirected there and comes back with a
  // one-time code that ConvexAuthProvider exchanges. On native the same round
  // trip runs in an ASWebAuthenticationSession / Custom Tab and the code is
  // exchanged here. Either way the code is useless without the PKCE verifier
  // held by this client.
  const browserSignIn = useCallback(
    async (provider: 'google' | 'apple', label: string) => {
      const redirectTo = authRedirectUrl();
      if (Platform.OS === 'web') {
        await signIn(provider, { redirectTo });
        return;
      }
      const { redirect } = await signIn(provider, { redirectTo });
      if (!redirect) throw new Error(`${label} sign-in could not be started.`);
      // Required lazily: the web branch above never needs the native browser.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
      const result = await WebBrowser.openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type !== 'success') return;
      const authCode = new URL(result.url).searchParams.get('code');
      if (!authCode) throw new Error(`${label} sign-in did not return an authorization code.`);
      await signIn(provider, { code: authCode });
    },
    [signIn],
  );

  const signInWithGoogle = useCallback(
    () => run(() => browserSignIn('google', 'Google')),
    [run, browserSignIn],
  );

  // iOS gets Apple's own sheet — Face ID, no browser — which is what the
  // platform and App Store review expect. It hands back an identity token that
  // `apple-native` verifies against Apple's published keys (convex/
  // AppleNative.ts) and turns into the same account the web flow would create.
  // Web and Android fall back to the browser round trip above.
  const signInWithApple = useCallback(
    () =>
      run(async () => {
        if (!supportsNativeAppleAuth()) {
          await browserSignIn('apple', 'Apple');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Apple = require('expo-apple-authentication') as typeof AppleAuth;
        if (!(await Apple.isAvailableAsync())) {
          await browserSignIn('apple', 'Apple');
          return;
        }
        const nonce = await createAppleNonce();
        let credential: AppleAuth.AppleAuthenticationCredential;
        try {
          credential = await Apple.signInAsync({
            nonce: nonce.hashed,
            requestedScopes: [
              Apple.AppleAuthenticationScope.FULL_NAME,
              Apple.AppleAuthenticationScope.EMAIL,
            ],
          });
        } catch (err) {
          if ((err as { code?: string }).code === APPLE_CANCELLED) return;
          throw err;
        }
        if (!credential.identityToken) {
          throw new Error('Apple sign-in did not return an identity token.');
        }
        const name = appleDisplayName(credential.fullName);
        await signIn('apple-native', {
          identityToken: credential.identityToken,
          nonce: nonce.raw,
          ...(name ? { name } : null),
        });
      }),
    [run, browserSignIn, signIn],
  );

  // Sending a code deliberately does not reveal whether the address already
  // has an account, so this cannot be used to enumerate users.
  const sendEmailCode = useCallback(
    (email: string) =>
      run(async () => {
        await signIn('resend-otp', { email: normalizeEmail(email) });
      }),
    [run, signIn],
  );

  const verifyEmailCode = useCallback(
    (email: string, code: string) =>
      run(async () => {
        await signIn('resend-otp', {
          email: normalizeEmail(email),
          code: code.replace(/\s+/g, ''),
        });
      }),
    [run, signIn],
  );

  return {
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
    signInWithGoogle,
    signInWithApple,
    sendEmailCode,
    verifyEmailCode,
  };
}
