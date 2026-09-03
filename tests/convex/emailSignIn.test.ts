import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
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
      t.action(api.auth.signIn, { provider: 'resend-otp', params: { email: 'person@example.com' } }),
    ).rejects.toThrow(/SITE_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces a Resend refusal as an error the client can explain', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('SITE_URL', 'https://xgamer791.github.io/macronaut');
    vi.stubEnv('CONVEX_SITE_URL', 'https://brainy-cobra-467.convex.site');
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ message: 'You can only send testing emails to your own email address' }), {
        status: 403,
      }),
    );
    const t = backend();
    await expect(
      t.action(api.auth.signIn, { provider: 'resend-otp', params: { email: 'person@example.com' } }),
    ).rejects.toThrow(/could not send/i);
  });
});
