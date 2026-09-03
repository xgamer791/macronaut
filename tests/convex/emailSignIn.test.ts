import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { describeResendFailure } from '../../convex/lib/resendErrors';
import { backend } from './helpers';

/** Exercises the real `auth:signIn` action for the email-code provider with
 * the network stubbed, so a broken provider config shows up here rather than
 * on the login screen. */
describe('email code sign-in (auth:signIn with resend-otp)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('creates a verification code and sends it through Resend', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Macronaut <onboarding@resend.dev>');
    vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
    vi.stubEnv('CONVEX_SITE_URL', 'https://brainy-cobra-467.convex.site');
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
      return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
    });

    const t = backend();
    const result = await t.action(api.auth.signIn, {
      provider: 'resend-otp',
      params: { email: 'person@example.com' },
    });
    expect(result).toMatchObject({ started: true });

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.resend.com/emails');
    expect(sent[0].body.to).toEqual(['person@example.com']);
    expect(String(sent[0].body.subject)).toMatch(/^\d{6} is your Macronaut sign-in code$/);

    const codes = await t.run(async (ctx) => ctx.db.query('authVerificationCodes').collect());
    expect(codes).toHaveLength(1);
  });

  it('fails before sending when SITE_URL is missing from the deployment', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('CONVEX_SITE_URL', 'https://brainy-cobra-467.convex.site');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const t = backend();
    await expect(
      t.action(api.auth.signIn, {
        provider: 'resend-otp',
        params: { email: 'person@example.com' },
      }),
    ).rejects.toThrow(/SITE_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports an unverified sender as "not available yet", not as a bad address', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
    vi.stubEnv('CONVEX_SITE_URL', 'https://brainy-cobra-467.convex.site');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            statusCode: 403,
            name: 'validation_error',
            message:
              'You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.',
          }),
          { status: 403 },
        ),
    );
    const t = backend();
    await expect(
      t.action(api.auth.signIn, {
        provider: 'resend-otp',
        params: { email: 'person@example.com' },
      }),
    ).rejects.toThrow(/not available yet/i);
  });

  it('reports an address Resend rejects as a send failure', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
    vi.stubEnv('CONVEX_SITE_URL', 'https://brainy-cobra-467.convex.site');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            statusCode: 422,
            name: 'validation_error',
            message: 'Invalid `to` field',
          }),
          {
            status: 422,
          },
        ),
    );
    const t = backend();
    await expect(
      t.action(api.auth.signIn, {
        provider: 'resend-otp',
        params: { email: 'person@example.com' },
      }),
    ).rejects.toThrow(/could not send/i);
  });
});

describe('describeResendFailure', () => {
  it('separates sender problems from address problems', () => {
    expect(
      describeResendFailure(403, 'You can only send testing emails to your own email address'),
    ).toMatch(/not available yet.*not verified/i);
    expect(describeResendFailure(403, 'The example.com domain is not verified')).toMatch(
      /not verified/i,
    );
    expect(describeResendFailure(401, 'API key is invalid')).toMatch(/not available yet/i);
    expect(describeResendFailure(429, 'Too many requests')).toMatch(/too many/i);
    expect(describeResendFailure(422, 'Invalid `to` field')).toMatch(
      /could not send.*that address/i,
    );
    expect(describeResendFailure(500, '')).toMatch(/could not send.*500/i);
  });

  it("never repeats Resend's detail to the client", () => {
    const detail = 'You can only send testing emails to your own email address (owner@example.com)';
    expect(describeResendFailure(403, detail)).not.toContain('owner@example.com');
  });
});
