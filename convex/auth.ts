import Google from '@auth/core/providers/google';
import { convexAuth } from '@convex-dev/auth/server';
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
 * Sign-in providers:
 *   - Google OAuth — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` on the deployment.
 *     Google's authorised redirect URI is `<CONVEX_SITE_URL>/api/auth/callback/google`.
 *   - Email code — see ResendOTP.ts.
 *
 * Sessions are JWTs signed with `JWT_PRIVATE_KEY`, verified against `JWKS`;
 * both are deployment environment variables (scripts/convex-auth-keys.mjs).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, ResendOTP],
  callbacks: {
    async redirect({ redirectTo }) {
      if (isAllowedRedirect(redirectTo, process.env.SITE_URL)) return redirectTo;
      throw new Error(`Refusing to redirect to ${redirectTo}`);
    },
  },
});
