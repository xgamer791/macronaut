/** Create-account asks whether an address is spoken for while it is being
 * typed, so nobody fills the whole form in only to be refused on submit. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { createRepos } from '../../src/state/AppProvider';
import type { ConvexCaller } from '../../src/repositories/convexCall';
import { backend, stubAuthKeys, type Backend } from './helpers';

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

/** The signed-out client the create-account screen is: no identity at all. */
function signedOutRepos(t: Backend) {
  const caller = {
    query: (fn: unknown, args: unknown) => (t.query as Function)(fn, args),
    mutation: (fn: unknown, args: unknown) => (t.mutation as Function)(fn, args),
    action: (fn: unknown, args: unknown) => (t.action as Function)(fn, args),
  } as unknown as ConvexCaller;
  return createRepos(caller);
}

describe('email availability', () => {
  beforeAll(stubAuthKeys);
  afterAll(() => vi.unstubAllEnvs());

  it('reports a free address as free', async () => {
    const t = backend();
    expect(await t.query(api.account.passwordAccountExists, { email: 'nobody@example.com' })).toBe(
      false,
    );
  });

  it('reports an address that already has a password account', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    expect(await t.query(api.account.passwordAccountExists, { email: 'person@example.com' })).toBe(
      true,
    );
  });

  it('matches the address the same way sign-up does', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    for (const email of ['Person@Example.com', '  PERSON@EXAMPLE.COM  ', 'person@example.com']) {
      expect(await t.query(api.account.passwordAccountExists, { email })).toBe(true);
    }
  });

  it('leaves a Google-only address free, because sign-up would accept it', async () => {
    const t = backend();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', { email: 'google@example.com' });
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'google',
        providerAccountId: 'google-1234',
      });
    });
    expect(await t.query(api.account.passwordAccountExists, { email: 'google@example.com' })).toBe(
      false,
    );
  });

  it('answers an empty address without a lookup', async () => {
    const t = backend();
    expect(await t.query(api.account.passwordAccountExists, { email: '   ' })).toBe(false);
  });

  it('answers the signed-out client the form uses', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    const { account } = signedOutRepos(t);
    expect(await account.emailTaken('person@example.com')).toBe(true);
    expect(await account.emailTaken('someone.else@example.com')).toBe(false);
  });

  it('agrees with the sign-up call it is trying to predict', async () => {
    const t = backend();
    await t.action(api.auth.signIn, SIGN_UP);
    const { account } = signedOutRepos(t);

    expect(await account.emailTaken(SIGN_UP.params.email)).toBe(true);
    await expect(
      t.action(api.auth.signIn, {
        ...SIGN_UP,
        params: { ...SIGN_UP.params, password: 'Different1' },
      }),
    ).rejects.toThrow(/already exists/i);

    const free = 'brand.new@example.com';
    expect(await account.emailTaken(free)).toBe(false);
    const created = await t.action(api.auth.signIn, {
      ...SIGN_UP,
      params: { ...SIGN_UP.params, email: free },
    });
    expect(created.tokens?.token).toBeTruthy();
    expect(await account.emailTaken(free)).toBe(true);
  });
});
