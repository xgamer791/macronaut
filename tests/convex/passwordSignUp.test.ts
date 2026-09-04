import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import {
  ageOnDate,
  isStrongSignupPassword,
  MIN_SIGNUP_AGE,
} from '../../convex/lib/signupAccount';
import { isValidSignupPassword } from '../../src/domain/signupCredentials';
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

/** Runs the real `auth:signIn` action, so what the create-account screen sends
 * is what these assertions cover. */
describe('create account (auth:signIn with the password provider)', () => {
  beforeAll(stubAuthKeys);
  afterAll(() => vi.unstubAllEnvs());

  it('creates the account, the user row and a session', async () => {
    const t = backend();
    const result = await t.action(api.auth.signIn, SIGN_UP);
    expect(result.tokens?.token).toBeTruthy();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: 'person@example.com',
      name: 'Ada Lovelace',
      birthday: '1990-08-14',
      country: 'United States',
    });

    const accounts = await t.run(async (ctx) => ctx.db.query('authAccounts').collect());
    expect(accounts).toHaveLength(1);
    expect(accounts[0].provider).toBe('password');
    expect(accounts[0].providerAccountId).toBe('person@example.com');
    // Only a hash is kept, never the password itself.
    expect(accounts[0].secret).toBeTruthy();
    expect(accounts[0].secret).not.toContain('Macronaut1');

    const sessions = await t.run(async (ctx) => ctx.db.query('authSessions').collect());
    expect(sessions).toHaveLength(1);
    expect(sessions[0].userId).toBe(users[0]._id);
  });

  it('reports the new account through the viewer query the app reads', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    const { userId, sessionId } = await t.run(async (ctx) => {
      const user = (await ctx.db.query('users').first())!;
      const session = (await ctx.db.query('authSessions').first())!;
      return { userId: user._id, sessionId: session._id };
    });

    const viewer = await t
      .withIdentity({ subject: `${userId}|${sessionId}` })
      .query(api.account.viewer, {});
    expect(viewer).toMatchObject({
      email: 'person@example.com',
      name: 'Ada Lovelace',
      birthday: '1990-08-14',
      country: 'United States',
      provider: 'password',
    });
  });

  it('signs the same account back in, and only with the right password', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);

    const signedIn = await t.action(api.auth.signIn, {
      provider: 'password',
      // Sign-in normalises the address the same way sign-up did.
      params: { flow: 'signIn', email: ' person@EXAMPLE.com ', password: 'Macronaut1' },
    });
    expect(signedIn.tokens?.token).toBeTruthy();

    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'signIn', email: 'person@example.com', password: 'Macronaut2' },
      }),
    ).rejects.toThrow(/InvalidSecret/);

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
  });

  it('never makes a second account on the same address', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);

    await expect(
      t.action(api.auth.signIn, {
        ...SIGN_UP,
        params: { ...SIGN_UP.params, password: 'Different1' },
      }),
    ).rejects.toThrow(/already exists/i);

    // Same address, same password: Convex Auth hands back the account that is
    // already there rather than a duplicate, so the person ends up signed in.
    const again = await t.action(api.auth.signIn, SIGN_UP);
    expect(again.tokens?.token).toBeTruthy();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
    const accounts = await t.run(async (ctx) => ctx.db.query('authAccounts').collect());
    expect(accounts).toHaveLength(1);
  });

  it('does not adopt an older account on the same address, or touch its data', async () => {
    const t = backend();
    // A Google-era account on the same address, from before create-account
    // asked for a password.
    const older = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        email: 'person@example.com',
        name: 'Ada from Google',
      });
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'google',
        providerAccountId: 'google-1234',
      });
      await ctx.db.insert('settings', { userId, key: 'displayName', value: '"Ada"' });
      return userId;
    });

    await t.action(api.auth.signIn, SIGN_UP);

    // Knowing an address is not knowing its password, so the sign-up cannot
    // claim that account: it gets its own, and the old rows stay where they
    // are. Forgot-password only resets an existing password account.
    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(2);
    const created = users.find((u) => u._id !== older)!;
    expect(created.name).toBe('Ada Lovelace');
    const accounts = await t.run(async (ctx) => ctx.db.query('authAccounts').collect());
    expect(accounts.filter((a) => a.userId === older).map((a) => a.provider)).toEqual(['google']);
    expect(accounts.filter((a) => a.userId === created._id).map((a) => a.provider)).toEqual([
      'password',
    ]);
    const settings = await t.run(async (ctx) => ctx.db.query('settings').collect());
    expect(settings.map((s) => s.userId)).toEqual([older]);
  });

  it('refuses a password the form would not have accepted', async () => {
    const t = backend();
    for (const password of ['short1A', 'macronaut1', 'MACRONAUT1', 'Macronauts']) {
      await expect(
        t.action(api.auth.signIn, { ...SIGN_UP, params: { ...SIGN_UP.params, password } }),
      ).rejects.toThrow(/8 characters/i);
    }
    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(0);
  });

  it('refuses an address, date of birth or country the form would not have sent', async () => {
    const t = backend();
    const cases: [Record<string, string>, RegExp][] = [
      [{ email: 'person@example' }, /email address/i],
      [{ birthday: '14-08-1990' }, /date of birth/i],
      [{ birthday: '1990-02-31' }, /date of birth/i],
      [{ birthday: '' }, /date of birth/i],
      [{ country: '' }, /country or region/i],
    ];
    for (const [override, message] of cases) {
      await expect(
        t.action(api.auth.signIn, { ...SIGN_UP, params: { ...SIGN_UP.params, ...override } }),
      ).rejects.toThrow(message);
    }
    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(0);
  });

  it('refuses anyone under 13, as the privacy policy says', async () => {
    const t = backend();
    const today = new Date();
    const tooYoung = `${today.getUTCFullYear() - MIN_SIGNUP_AGE + 1}-01-01`;
    await expect(
      t.action(api.auth.signIn, { ...SIGN_UP, params: { ...SIGN_UP.params, birthday: tooYoung } }),
    ).rejects.toThrow(new RegExp(`at least ${MIN_SIGNUP_AGE}`, 'i'));
  });
});

describe('the password rule the button and the server share', () => {
  it('agrees on every case', () => {
    const cases = [
      'Macronaut1',
      'aA1aaaaa',
      'short1A',
      'macronaut1',
      'MACRONAUT1',
      'Macronauts',
      '',
      '        ',
      'Aa1' + 'x'.repeat(200),
    ];
    for (const password of cases) {
      expect(isStrongSignupPassword(password)).toBe(isValidSignupPassword(password));
    }
  });
});

describe('ageOnDate', () => {
  it('counts the birthday itself as the day someone turns that age', () => {
    expect(ageOnDate('1990-08-14', new Date('2026-08-13T00:00:00Z'))).toBe(35);
    expect(ageOnDate('1990-08-14', new Date('2026-08-14T00:00:00Z'))).toBe(36);
    expect(ageOnDate('1990-12-31', new Date('2026-01-01T00:00:00Z'))).toBe(35);
  });
});
