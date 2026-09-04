import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { parsePasswordResetLink, passwordResetLink } from '../../convex/lib/passwordResetLink';
import { randomUrlToken } from '../../convex/ResendOTP';
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

const SITE = 'https://xgamer791.github.io/macronaut';

function stubResend() {
  vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
  vi.stubEnv('AUTH_EMAIL_FROM', 'Macronaut <onboarding@resend.dev>');
  vi.stubEnv('SITE_URL', SITE);
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  });
  return sent;
}

function resetFromEmail(sent: { body: Record<string, unknown> }[]) {
  const text = String(sent[0]?.body.text ?? '');
  const match = text.match(/https:\/\/\S+/);
  expect(match?.[0]).toBeTruthy();
  return parsePasswordResetLink(match![0]);
}

/** The real `auth:signIn` reset flows, with Resend stubbed so a broken
 * provider config shows up here rather than on the forgot-password screen. */
describe('password reset (auth:signIn with flow reset)', () => {
  beforeAll(stubAuthKeys);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emails a reset link and then accepts that token with a new password', async () => {
    const sent = stubResend();
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);

    const requested = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'reset', email: ' person@EXAMPLE.com ' },
    });
    // Reset starts a verification; there is no session until the link is used.
    expect(requested.tokens ?? null).toBeNull();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.resend.com/emails');
    expect(sent[0].body.to).toEqual(['person@example.com']);
    expect(sent[0].body.subject).toBe('Reset your Macronaut password');
    expect(String(sent[0].body.subject)).not.toMatch(/\d{6}/);
    expect(String(sent[0].body.html)).toContain('Choose a new password');
    expect(String(sent[0].body.html)).toContain(`${SITE}/forgot-password?`);
    expect(String(sent[0].body.text)).not.toContain('code=');
    expect(String(sent[0].body.html)).not.toContain('code=');

    const { email, token } = resetFromEmail(sent);
    expect(email).toBe('person@example.com');
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const codes = await t.run(async (ctx) => ctx.db.query('authVerificationCodes').collect());
    expect(codes).toHaveLength(1);
    expect(codes[0]?.code).not.toBe(token);

    const reset = await t.action(api.auth.signIn, {
      provider: 'password',
      params: {
        flow: 'reset-verification',
        email,
        code: token,
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

  it('refuses a wrong token and a weak new password', async () => {
    const sent = stubResend();
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'reset', email: 'person@example.com' },
    });
    const { token } = resetFromEmail(sent);

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: {
          flow: 'reset-verification',
          email: 'person@example.com',
          code: '0'.repeat(64),
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
          code: token,
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
    const result = await t.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'reset', email: 'nobody@example.com' },
    });
    // Same "started, no session" shape as a real send, so the API cannot
    // be used to see whether an address is registered.
    expect(result.tokens ?? null).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('fails before sending when the Resend key is missing', async () => {
    vi.stubEnv('SITE_URL', SITE);
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

  it('fails before sending when SITE_URL is missing', async () => {
    vi.unstubAllEnvs();
    await stubAuthKeys();
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'reset', email: 'person@example.com' },
      }),
    ).rejects.toThrow(/SITE_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('password reset link', () => {
  it('points at the live forgot-password page with email and token, not code', () => {
    const token = randomUrlToken(32);
    const href = passwordResetLink(SITE, ' Person@Example.com ', token);
    expect(href.startsWith(`${SITE}/forgot-password?`)).toBe(true);
    expect(parsePasswordResetLink(href)).toEqual({
      email: 'person@example.com',
      token,
    });
    expect(href).not.toContain('code=');
  });

  it('produces 64 lowercase hex characters', () => {
    for (let i = 0; i < 20; i += 1) expect(randomUrlToken(32)).toMatch(/^[0-9a-f]{64}$/);
  });
});
