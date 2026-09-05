import { isPlausibleEmail, normalizeEmail } from '@/services/auth/email';

export function isValidSignupName(name: string): boolean {
  return name.trim().length > 0;
}

export function emailsMatch(email: string, confirm: string): boolean {
  return isPlausibleEmail(email) && normalizeEmail(email) === normalizeEmail(confirm);
}

/** Helper copy on the create-account frame: 8+ characters, upper, lower, number. */
export function isValidSignupPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

/** What create-account knows about the address being typed. */
export type EmailAvailability =
  /** Nothing worth asking about yet: empty, or not an address. */
  | 'idle'
  /** Typing has settled but the answer is not back. */
  | 'checking'
  | 'available'
  | 'taken'
  /** The lookup failed — offline, most likely. */
  | 'unknown';

/** Create Account stays out of reach while an address is known to be taken,
 * and while the answer is still coming. A failed lookup does not trap anyone:
 * the sign-up call refuses a duplicate on its own. */
export function emailAllowsSignup(status: EmailAvailability): boolean {
  return status === 'available' || status === 'unknown';
}

/** Whether a confirmation field has said enough to be called a mismatch. A
 * half-typed copy is not wrong yet, so it waits for the field to be left or
 * for it to reach the length of what it is copying. */
export function confirmationSettled(
  confirmation: string,
  source: string,
  touched: boolean,
): boolean {
  return confirmation.length > 0 && (touched || confirmation.length >= source.length);
}

export function isValidSignupCredentials(
  name: string,
  email: string,
  confirmEmail: string,
  password: string,
  confirmPassword: string,
): boolean {
  return (
    isValidSignupName(name) &&
    emailsMatch(email, confirmEmail) &&
    isValidSignupPassword(password) &&
    passwordsMatch(password, confirmPassword)
  );
}
