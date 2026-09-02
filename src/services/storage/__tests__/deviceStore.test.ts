/* eslint-disable import/first -- jest.mock factories must be declared before the module under test is imported. */

/** The native store keeps values in SecureStore, which rejects anything over
 * 2048 bytes — and a Supabase session is routinely larger. These tests run the
 * real chunking code against a SecureStore stub that enforces that limit. */

const SECURE_STORE_LIMIT = 2048;

const backing = new Map<string, string>();

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => backing.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (Buffer.byteLength(value, 'utf8') > SECURE_STORE_LIMIT) {
      throw new Error(`value for ${key} exceeds the SecureStore size limit`);
    }
    backing.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    backing.delete(key);
  }),
}));

import { getDeviceStore, setDeviceStoreForTesting } from '../deviceStore';

beforeEach(() => {
  backing.clear();
  setDeviceStoreForTesting(null);
});

describe('native device store', () => {
  it('round-trips a value larger than the SecureStore limit', async () => {
    const store = getDeviceStore();
    const session = 'x'.repeat(SECURE_STORE_LIMIT * 3);

    await store.setItem('macronaut.auth.session', session);

    expect(await store.getItem('macronaut.auth.session')).toBe(session);
  });

  it('round-trips small values and empty strings', async () => {
    const store = getDeviceStore();
    await store.setItem('macronaut.db.legacyOwner', 'user-1');
    expect(await store.getItem('macronaut.db.legacyOwner')).toBe('user-1');

    await store.setItem('macronaut.db.legacyOwner', '');
    expect(await store.getItem('macronaut.db.legacyOwner')).toBe('');
  });

  it('returns null for a key that was never written', async () => {
    expect(await getDeviceStore().getItem('macronaut.absent')).toBeNull();
  });

  it('drops stale chunks when a value shrinks', async () => {
    const store = getDeviceStore();
    await store.setItem('macronaut.auth.session', 'y'.repeat(SECURE_STORE_LIMIT * 3));
    await store.setItem('macronaut.auth.session', 'short');

    expect(await store.getItem('macronaut.auth.session')).toBe('short');
    const leftovers = [...backing.keys()].filter((key) => /\.\d+$/.test(key));
    expect(leftovers).toEqual(['macronaut.auth.session.0']);
  });

  it('removes every chunk on removeItem', async () => {
    const store = getDeviceStore();
    await store.setItem('macronaut.auth.session', 'z'.repeat(SECURE_STORE_LIMIT * 2));
    await store.removeItem('macronaut.auth.session');

    expect(await store.getItem('macronaut.auth.session')).toBeNull();
    expect(backing.size).toBe(0);
  });

  it('treats a half-written value as absent rather than returning a truncated session', async () => {
    const store = getDeviceStore();
    await store.setItem('macronaut.auth.session', 'w'.repeat(SECURE_STORE_LIMIT * 3));
    backing.delete('macronaut.auth.session.1');

    expect(await store.getItem('macronaut.auth.session')).toBeNull();
  });

  it('rejects keys that could escape the SecureStore namespace', async () => {
    const store = getDeviceStore();
    await expect(store.getItem('../../etc/passwd')).rejects.toThrow(/invalid device store key/i);
    await expect(store.setItem('has space', 'v')).rejects.toThrow(/invalid device store key/i);
  });
});
