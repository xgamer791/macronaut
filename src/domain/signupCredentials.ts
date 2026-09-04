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
