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
export const PasswordAccount = Password<DataModel>({
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
