import { Email } from '@convex-dev/auth/providers/Email';
import { ConvexError } from 'convex/values';
import { describeResendFailure } from './lib/resendErrors';
import { randomDigits } from './ResendOTP';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;

/** Six-digit password-reset codes through Resend. Same delivery path as the
 * leftover email sign-in provider; a different `id` so Convex Auth can tell
 * the two verification tables apart. The code is the whole proof that the
 * person can read that inbox, so it is generated from a CSPRNG and expires
 * in ten minutes. Convex Auth stores only a hash of it.
 *
 * Environment (set on the Convex deployment, never in the app bundle):
 *   AUTH_RESEND_KEY   Resend API key
 *   AUTH_EMAIL_FROM   e.g. "Macronaut <noreply@example.com>" */
export const ResendOTPPasswordReset = Email({
  id: 'password-reset',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: CODE_TTL_SECONDS,

  normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),

  async generateVerificationToken() {
    return randomDigits(CODE_LENGTH);
  },

  async sendVerificationRequest({ identifier: email, provider, token, expires }) {
    const from = process.env.AUTH_EMAIL_FROM ?? 'Macronaut <onboarding@resend.dev>';
    if (!provider.apiKey) {
      throw new ConvexError(
        'Could not send the reset code: AUTH_RESEND_KEY is not set on the deployment',
      );
    }
    const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60_000));
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${token} is your Macronaut password reset code`,
        text: [
          `Your Macronaut password reset code is ${token}.`,
          '',
          `It expires in ${minutes} minutes. If you did not ask to reset your password, ignore this email.`,
        ].join('\n'),
        html: [
          '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5">',
          '<h2 style="margin:0 0 12px">Reset your Macronaut password</h2>',
          `<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 16px">${token}</p>`,
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
