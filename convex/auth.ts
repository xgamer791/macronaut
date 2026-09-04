import Apple from '@auth/core/providers/apple';
import Google from '@auth/core/providers/google';
import { convexAuth } from '@convex-dev/auth/server';
import { AppleNative } from './AppleNative';
import { PasswordAccount } from './PasswordAccount';
import { ResendOTP } from './ResendOTP';

/** Native builds return to the app's own scheme (app.config.ts → `scheme`);
 * Expo Go and `expo start --web` use their dev URLs. Anything else must be
 * the deployed site (SITE_URL on the Convex deployment). */
const NATIVE_SCHEME = 'macronaut://';

export function isAllowedRedirect(redirectTo: string, siteUrl: string | undefined): boolean {
  if (siteUrl && redirectTo.startsWith(siteUrl)) return true;
  if (redirectTo.startsWith(NATIVE_SCHEME)) return true;
  // Development only. Both are useless to an attacker: the code delivered to
  // the redirect is a one-time Convex code that can only be exchanged by the
  // client holding the PKCE verifier that started the flow.
  if (/^exp:\/\//.test(redirectTo)) return true;
  if (/^http:\/\/localhost(:\d+)?\//.test(redirectTo)) return true;
  return false;
}

/**
 * Apple returns a name only the first time somebody consents, in a `user` field
 * that is not part of the id token, and its own `profile` callback returns
 * `image: null` — which the `users` table (`v.optional(v.string())`) rejects. So
 * the callback is replaced rather than extended.
 */
const AppleOAuth = Apple({
  profile: (apple) => ({
    id: apple.sub,
    ...(apple.user ? { name: `${apple.user.name.firstName} ${apple.user.name.lastName}` } : null),
    email: apple.email,
  }),
});

/**
 * Sign-in providers:
 *   - Email and password — see PasswordAccount.ts. The only one the app
 *     offers: create-account collects the address, the password, the name,
 *     the date of birth and the country, and sign-in takes the address and
 *     the password. Forgot-password emails a six-digit reset code through
 *     Resend (`password-reset` in ResendOTPPasswordReset.ts) and then
 *     accepts the token from that link plus a new password.
 *   - Google OAuth — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` on the deployment.
 *     Google's authorised redirect URI is `<CONVEX_SITE_URL>/api/auth/callback/google`.
 *   - Apple OAuth (web and Android) — `AUTH_APPLE_ID` (the Services ID,
 *     `com.mangomarketeers.macronaut.web`) / `AUTH_APPLE_SECRET` (the client
 *     secret JWT).
 *     Apple's return URL is `<CONVEX_SITE_URL>/api/auth/callback/apple`, and it
 *     POSTs the callback (`response_mode=form_post`), which Convex Auth handles.
 *   - Apple native (iOS) — see AppleNative.ts. Writes to the same `apple`
 *     accounts, and needs no secret of its own.
 *   - Email code — see ResendOTP.ts.
 *
 * The app only offers email and password. Google, Apple and the email code
 * stay configured so accounts created with them still resolve to the same
 * user, but no screen starts those flows any more (docs/accounts.md).
 *
 * Sessions are JWTs signed with `JWT_PRIVATE_KEY`, verified against `JWKS`;
 * both are deployment environment variables (scripts/convex-auth-keys.mjs).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordAccount, Google, AppleOAuth, AppleNative, ResendOTP],
  callbacks: {
    async redirect({ redirectTo }) {
      if (isAllowedRedirect(redirectTo, process.env.SITE_URL)) return redirectTo;
      throw new Error(`Refusing to redirect to ${redirectTo}`);
    },
  },
});
