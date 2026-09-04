import { useAuthActions } from '@convex-dev/auth/react';
import { useCallback, useState } from 'react';
import { normalizeEmail } from '@/services/auth/email';
import { friendlyAuthError, isUnknownPasswordAccount } from '@/services/auth/errors';

/** Everything create-account collects. Name, date of birth and country are
 * stored on the account by the same call that creates it, so an account
 * cannot exist without them (convex/PasswordAccount.ts). */
export interface NewAccount {
  name: string;
  email: string;
  password: string;
  /** ISO `YYYY-MM-DD`. */
  birthday: string;
  country: string;
}

export interface AccountAuth {
  /** A round trip is in flight; every control should be disabled. */
  busy: boolean;
  /** Last failure, already turned into something a person can act on. */
  error: string | null;
  clearError: () => void;
  /** Creates the account and signs in. True when the session is live. */
  createAccount: (account: NewAccount) => Promise<boolean>;
  /** Signs in an existing account. On success AuthProvider publishes the
   * session and the screen moves on. */
  signIn: (email: string, password: string) => Promise<boolean>;
  /** Emails a six-digit reset code. Resolves true when the person should
   * check their inbox — including when no password account exists, so the
   * screen cannot be used to see whether an email is registered. */
  requestPasswordReset: (email: string) => Promise<boolean>;
  /** Exchanges the code for a new password and a session. */
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<boolean>;
}

/** The ways into Macronaut: create an account, sign in, or reset a password.
 * All three are the `password` provider on the Convex deployment; the
 * password itself is hashed there and never stored by the app. */
export function useAccountAuth(): AccountAuth {
  const { signIn: convexSignIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (flow: 'signup' | 'signin' | 'reset', action: () => Promise<void>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await action();
        return true;
      } catch (err) {
        setError(friendlyAuthError(err, flow));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const createAccount = useCallback(
    (account: NewAccount) =>
      run('signup', async () => {
        await convexSignIn('password', {
          flow: 'signUp',
          email: normalizeEmail(account.email),
          password: account.password,
          name: account.name.trim(),
          birthday: account.birthday,
          country: account.country,
        });
      }),
    [run, convexSignIn],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      run('signin', async () => {
        await convexSignIn('password', {
          flow: 'signIn',
          email: normalizeEmail(email),
          password,
        });
      }),
    [run, convexSignIn],
  );

  const requestPasswordReset = useCallback(
    (email: string) =>
      run('reset', async () => {
        try {
          await convexSignIn('password', {
            flow: 'reset',
            email: normalizeEmail(email),
          });
        } catch (err) {
          // Missing password account: same "check your email" success as a
          // real send, so this cannot enumerate users.
          if (isUnknownPasswordAccount(err)) return;
          throw err;
        }
      }),
    [run, convexSignIn],
  );

  const confirmPasswordReset = useCallback(
    (email: string, code: string, newPassword: string) =>
      run('reset', async () => {
        await convexSignIn('password', {
          flow: 'reset-verification',
          email: normalizeEmail(email),
          code: code.replace(/\s+/g, ''),
          newPassword,
        });
      }),
    [run, convexSignIn],
  );

  return {
    busy,
    error,
    clearError: useCallback(() => setError(null), []),
    createAccount,
    signIn,
    requestPasswordReset,
    confirmPasswordReset,
  };
}
