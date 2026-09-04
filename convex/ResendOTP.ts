import { Email } from '@convex-dev/auth/providers/Email';
import { ConvexError } from 'convex/values';
import { describeResendFailure } from './lib/resendErrors';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;

/** Uniformly random lowercase hex from the platform CSPRNG. URL-safe, so it
 * can sit in an emailed reset link without encoding surprises. */
export function randomUrlToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Uniformly random decimal digits from the platform CSPRNG. Bytes at or
 * above 250 are discarded so `byte % 10` is unbiased. */
export function randomDigits(length: number): string {
  let out = '';
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 250) out += String(byte % 10);
      if (out.length === length) break;
    }
  }
  return out;
}

/** Six-digit email codes delivered through Resend. The code is the whole
 * credential, so it is generated from a cryptographic source and expires in
 * ten minutes. Convex Auth stores only a hash of it and rate-limits guesses.
 *
 * Environment (set on the Convex deployment, never in the app bundle):
 *   AUTH_RESEND_KEY   Resend API key
 *   AUTH_EMAIL_FROM   e.g. "Macronaut <noreply@example.com>"; the address must
 *                     belong to a domain verified in Resend, or use Resend's
 *                     onboarding sender while testing. */
export const ResendOTP = Email({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: CODE_TTL_SECONDS,

  normalizeIdentifier: (identifier) => identifier.trim().toLowerCase(),

  async generateVerificationToken() {
    return randomDigits(CODE_LENGTH);
  },

  async sendVerificationRequest({ identifier: email, provider, token, expires }) {
    const from = process.env.AUTH_EMAIL_FROM ?? 'Macronaut <onboarding@resend.dev>';
    // ConvexError, not Error: production deployments replace plain error
    // messages with "Server Error" before they reach the client, and these
    // are the ones the login screen needs to explain.
    if (!provider.apiKey) {
      throw new ConvexError(
        'Could not send the sign-in code: AUTH_RESEND_KEY is not set on the deployment',
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
        subject: `${token} is your Macronaut sign-in code`,
        text: [
          `Your Macronaut sign-in code is ${token}.`,
          '',
          `It expires in ${minutes} minutes. If you did not ask for it, ignore this email.`,
        ].join('\n'),
        html: [
          '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5">',
          '<h2 style="margin:0 0 12px">Your Macronaut sign-in code</h2>',
          `<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 16px">${token}</p>`,
          `<p style="margin:0;color:#555">It expires in ${minutes} minutes. If you did not ask for it, ignore this email.</p>`,
          '</div>',
        ].join(''),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // The detail is logged for the dashboard; the client only learns what
      // kind of refusal it was, which is what the person can act on.
      console.error(`Resend refused the sign-in email (${response.status}): ${detail}`);
      throw new ConvexError(describeResendFailure(response.status, detail));
    }
  },
});
