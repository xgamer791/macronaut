import { Password } from '@convex-dev/auth/providers/Password';
import type { DataModel } from './_generated/dataModel';
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset';
import {
  assertStrongSignupPassword,
  signupBirthday,
  signupCountry,
  signupEmail,
  signupName,
} from './lib/signupAccount';

/**
 * Email and password, the way into Macronaut. Convex Auth hashes the password
 * with Scrypt and stores only the hash on the `authAccounts` row; nothing here
 * ever sees or keeps the plaintext.
 *
 * `profile` runs on every flow, so it only demands the create-account fields
 * when one is being created. Signing in sends the address and the password and
 * nothing else. Reset sends the address, then the code plus a new password.
 * Name, date of birth and country are written with the user row
 * in the same transaction that creates the account, so an account cannot exist
 * without them.
 */
const password = Password<DataModel>({
  reset: ResendOTPPasswordReset,
  profile(params) {
    const email = signupEmail(params.email);
    if (params.flow !== 'signUp') return { email };
    return {
      email,
      name: signupName(params.name),
      birthday: signupBirthday(params.birthday),
      country: signupCountry(params.country),
    };
  },
  validatePasswordRequirements: assertStrongSignupPassword,
});

function isMissingPasswordAccount(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return /invalidaccountid|could not find|no account|cannot find account/i.test(raw);
}

type CredentialsOptions = {
  authorize: (
    params: Record<string, unknown>,
    ctx: unknown,
  ) => Promise<{ userId: string; sessionId?: string } | null>;
};

/** ConvexCredentials stores the real `authorize` on `options`. A missing
 * password account must not throw: production redacts that Error to
 * "Server Error", which would tell the forgot-password screen that the
 * address is unknown. Returning null is the same "started, no session"
 * shape as a real send. */
const options = (password as unknown as { options: CredentialsOptions }).options;
const authorize = options.authorize.bind(options);
options.authorize = async (params, ctx) => {
  try {
    return await authorize(params, ctx);
  } catch (err) {
    if (params.flow === 'reset' && isMissingPasswordAccount(err)) return null;
    throw err;
  }
};

export const PasswordAccount = password;
