import { ConvexError } from 'convex/values';

/** What the create-account form collects, checked again on the server. The
 * form greys out its button until every rule here passes, so a failure means
 * either a stale client or someone calling `auth:signIn` directly. Errors are
 * `ConvexError`s so the message survives to the client on a production
 * deployment, where uncaught `Error`s are redacted. */

const NAME_MAX = 60;
const COUNTRY_MAX = 60;
/** Privacy policy: Macronaut is not directed at children under 13. */
export const MIN_SIGNUP_AGE = 13;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The rule the form states under the password field: eight characters with an
 * upper case letter, a lower case letter and a digit. `isValidSignupPassword`
 * in src/domain/signupCredentials.ts is the same rule for the button state;
 * tests/convex/passwordSignUp.test.ts keeps the two in step. */
export function isStrongSignupPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
}

export function assertStrongSignupPassword(password: string): void {
  if (!isStrongSignupPassword(password)) {
    throw new ConvexError(
      'Passwords need at least 8 characters, one uppercase letter, one lowercase letter and one number.',
    );
  }
}

/** One address is one account, so the stored form is trimmed and lower case. */
export function signupEmail(value: unknown): string {
  const email = text(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConvexError('Enter an email address we can reach you at.');
  }
  return email;
}

/** Display name. User-controlled text, so it is capped here and again wherever
 * it is shown. */
export function signupName(value: unknown): string | undefined {
  const name = text(value).slice(0, NAME_MAX);
  return name.length > 0 ? name : undefined;
}

export function ageOnDate(birthday: string, today: Date): number {
  const [year, month, day] = birthday.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  const monthIndex = month - 1;
  if (
    today.getUTCMonth() < monthIndex ||
    (today.getUTCMonth() === monthIndex && today.getUTCDate() < day)
  ) {
    age -= 1;
  }
  return age;
}

/** ISO `YYYY-MM-DD`, and a date that can exist. Date of birth decides whether
 * the account may be created at all, and the app never lets it be changed
 * afterwards, so it is validated where it is stored. */
export function signupBirthday(value: unknown, today: Date = new Date()): string {
  const birthday = text(value);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!parts) throw new ConvexError('Enter your date of birth.');
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const real =
    year >= 1900 &&
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day;
  if (!real) throw new ConvexError('Enter your date of birth.');
  if (ageOnDate(birthday, today) < MIN_SIGNUP_AGE) {
    throw new ConvexError(`You must be at least ${MIN_SIGNUP_AGE} to use Macronaut.`);
  }
  return birthday;
}

export function signupCountry(value: unknown): string {
  const country = text(value).slice(0, COUNTRY_MAX);
  if (!country) throw new ConvexError('Choose your country or region.');
  return country;
}
