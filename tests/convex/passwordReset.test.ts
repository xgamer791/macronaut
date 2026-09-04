import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, stubAuthKeys } from './helpers';

const SIGN_UP = {
  provider: 'password',
  params: {
    flow: 'signUp',
    email: 'Person@Example.com',
    password: 'Macronaut1',
    name: 'Ada Lovelace',
    birthday: '1990-08-14',
    country: 'United States',
  },
} as const;

function stubResend() {
  vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
  vi.stubEnv('AUTH_EMAIL_FROM', 'Macronaut <onboarding@resend.dev>');
  vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  });
  return sent;
}

/** The real `auth:signIn` reset flows, with Resend stubbed so a broken
 * provider config shows up here rather than on the forgot-password screen. */
describe('password reset (auth:signIn with flow reset)', () => {
  beforeAll(stubAuthKeys);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emails a six-digit code and then accepts it with a new password', async () => {
    const sent = stubResend();
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);

    const requested = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'reset', email: ' person@EXAMPLE.com ' },
    });
    // Reset starts a verification; there is no session until the code lands.
    expect(requested.tokens ?? null).toBeNull();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.resend.com/emails');
    expect(sent[0].body.to).toEqual(['person@example.com']);
    expect(String(sent[0].body.subject)).toMatch(/^\d{6} is your Macronaut password reset code$/);
    const code = String(sent[0].body.subject).slice(0, 6);

    const codes = await t.run(async (ctx) => ctx.db.query('authVerificationCodes').collect());
    expect(codes).toHaveLength(1);

    const reset = await t.action(api.auth.signIn, {
      provider: 'password',
      params: {
        flow: 'reset-verification',
        email: 'person@example.com',
        code,
        newPassword: 'Macronaut2',
      },
    });
    expect(reset.tokens?.token).toBeTruthy();

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'signIn', email: 'person@example.com', password: 'Macronaut1' },
      }),
    ).rejects.toThrow(/InvalidSecret/);

    const signedIn = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: 'person@example.com', password: 'Macronaut2' },
    });
    expect(signedIn.tokens?.token).toBeTruthy();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
  });

  it('refuses a wrong code and a weak new password', async () => {
    const sent = stubResend();
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'reset', email: 'person@example.com' },
    });
    const code = String(sent[0].body.subject).slice(0, 6);

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: {
          flow: 'reset-verification',
          email: 'person@example.com',
          code: '000000',
          newPassword: 'Macronaut2',
        },
      }),
    ).rejects.toThrow(/verify code|invalid/i);

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: {
          flow: 'reset-verification',
          email: 'person@example.com',
          code,
          newPassword: 'short1A',
        },
      }),
    ).rejects.toThrow(/8 characters/i);

    const signedIn = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: 'person@example.com', password: 'Macronaut1' },
    });
    expect(signedIn.tokens?.token).toBeTruthy();
  });

  it('does not send mail when that address has no password account', async () => {
    const sent = stubResend();
    const t = backend();
    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'reset', email: 'nobody@example.com' },
      }),
    ).rejects.toThrow(/InvalidAccountId|account/i);
    expect(sent).toHaveLength(0);
  });

  it('fails before sending when the Resend key is missing', async () => {
    vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
    vi.stubEnv('AUTH_RESEND_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'reset', email: 'person@example.com' },
      }),
    ).rejects.toThrow(/AUTH_RESEND_KEY/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
