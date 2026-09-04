import { Email } from '@convex-dev/auth/providers/Email';
import { ConvexError } from 'convex/values';
import {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TTL_SECONDS,
  passwordResetLink,
} from './lib/passwordResetLink';
import { describeResendFailure } from './lib/resendErrors';
import { randomUrlToken } from './ResendOTP';

/** Password-reset links through Resend. The token is the whole proof that the
 * person can read that inbox, so it is generated from a CSPRNG, lives for an
 * hour, and is long enough to be a credential on its own. Convex Auth stores
 * only a hash of it. The email carries a link to the reset page — not a
 * typed code — so the new-password fields stay hidden until that link opens.
 *
 * Environment (set on the Convex deployment, never in the app bundle):
 *   AUTH_RESEND_KEY   Resend API key
 *   AUTH_EMAIL_FROM   e.g. "Macronaut <noreply@example.com>"
 *   SITE_URL          Live app origin, including the Pages base path */
export const ResendOTPPasswordReset = Email({
  id: 'password-reset',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: PASSWORD_RESET_TTL_SECONDS,

  normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),

  async generateVerificationToken() {
    return randomUrlToken(PASSWORD_RESET_TOKEN_BYTES);
  },

  async sendVerificationRequest({ identifier, token, expires }) {
    const email = identifier.trim().toLowerCase();
    const from = process.env.AUTH_EMAIL_FROM ?? 'Macronaut <onboarding@resend.dev>';
    // Read the live env, not the value captured when this module loaded:
    // convex-auth also mutates `provider.apiKey` from the first successful
    // test, which would hide a missing key later.
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new ConvexError(
        'Could not send the reset link: AUTH_RESEND_KEY is not set on the deployment',
      );
    }
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      throw new ConvexError('Could not send the reset link: SITE_URL is not set on the deployment');
    }
    const link = passwordResetLink(siteUrl, email, token);
    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60_000));
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Reset your Macronaut password',
        text: [
          'Reset your Macronaut password by opening this link:',
          '',
          link,
          '',
          `It expires in ${minutes} minutes. If you did not ask to reset your password, ignore this email.`,
        ].join('\n'),
        html: [
          '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5">',
          '<h2 style="margin:0 0 12px">Reset your Macronaut password</h2>',
          '<p style="margin:0 0 16px">Click the button to choose a new password. If the button does not work, paste the link into your browser.</p>',
          `<p style="margin:0 0 16px"><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#17A673;color:#ffffff;text-decoration:none;font-weight:600">Choose a new password</a></p>`,
          `<p style="margin:0 0 16px;word-break:break-all;color:#555">${safeLink}</p>`,
          `<p style="margin:0;color:#555">It expires in ${minutes} minutes. If you did not ask to reset your password, ignore this email.</p>`,
          '</div>',
        ].join(''),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`Resend refused the reset email (${response.status}): ${detail}`);
      throw new ConvexError(describeResendFailure(response.status, detail));
    }
  },
});
