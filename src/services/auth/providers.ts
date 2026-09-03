/** The sign-in methods, in the order they appear on screen. App Store review
 * requires Sign in with Apple wherever another third-party sign-in is
 * offered, and Apple's guidelines want it no less prominent, so it is first. */
export type ProviderId = 'apple' | 'google' | 'email';

export const PROVIDER_ORDER: readonly ProviderId[] = ['apple', 'google', 'email'];

/** Signing in and creating an account are the same action on the backend —
 * the account is created on first sign-in — so the two screens differ only in
 * what they say. */
export type AuthMode = 'signin' | 'signup';

const PROVIDER_NAMES: Record<ProviderId, string> = {
  apple: 'Apple',
  google: 'Google',
  email: 'Email',
};

export function providerLabel(mode: AuthMode, provider: ProviderId): string {
  return `${mode === 'signup' ? 'Sign up' : 'Continue'} with ${PROVIDER_NAMES[provider]}`;
}
