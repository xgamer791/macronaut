import {
  createMemoryDeviceStore,
  setDeviceStoreForTesting,
  type DeviceStore,
} from '@/services/storage/deviceStore';
import {
  LEGACY_SCOPE,
  dbFileNameForScope,
  idbKeyForScope,
  resolveDbScope,
  scopeForUserId,
} from '../scope';

const USER_A = '5b2a1c4e-0000-4000-8000-000000000001';
const USER_B = '5b2a1c4e-0000-4000-8000-000000000002';

beforeEach(() => {
  setDeviceStoreForTesting(createMemoryDeviceStore());
});

afterAll(() => {
  setDeviceStoreForTesting(null);
});

describe('scopeForUserId', () => {
  it('strips everything that is not alphanumeric', () => {
    expect(scopeForUserId(USER_A)).toBe('u5b2a1c4e000040008000000000000001');
  });

  it('is stable across calls and case', () => {
    expect(scopeForUserId('AB-CD')).toBe(scopeForUserId('ab-cd'));
  });

  it('never returns the legacy scope for a real user', () => {
    expect(scopeForUserId(USER_A)).not.toBe(LEGACY_SCOPE);
  });

  it('refuses an id with nothing usable in it', () => {
    expect(() => scopeForUserId('---')).toThrow(/empty user id/i);
  });
});

describe('resolveDbScope', () => {
  it('uses the legacy database in local-only mode', async () => {
    await expect(resolveDbScope(null)).resolves.toBe(LEGACY_SCOPE);
  });

  it('gives the pre-accounts database to the first account that signs in', async () => {
    await expect(resolveDbScope(USER_A)).resolves.toBe(LEGACY_SCOPE);
    await expect(resolveDbScope(USER_A)).resolves.toBe(LEGACY_SCOPE);
  });

  it('isolates a second account from the first account data', async () => {
    await resolveDbScope(USER_A);
    const scopeB = await resolveDbScope(USER_B);
    expect(scopeB).toBe(scopeForUserId(USER_B));
    expect(scopeB).not.toBe(LEGACY_SCOPE);
  });

  it('keeps returning the same scope for each account', async () => {
    await resolveDbScope(USER_A);
    await expect(resolveDbScope(USER_B)).resolves.toBe(await resolveDbScope(USER_B));
    await expect(resolveDbScope(USER_A)).resolves.toBe(LEGACY_SCOPE);
  });

  it('falls back to a private scope when the device store cannot be read', async () => {
    const broken: DeviceStore = {
      getItem: () => Promise.reject(new Error('keychain unavailable')),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
    setDeviceStoreForTesting(broken);
    await expect(resolveDbScope(USER_A)).resolves.toBe(scopeForUserId(USER_A));
  });

  it('falls back to a private scope when ownership cannot be recorded', async () => {
    const unwritable: DeviceStore = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.reject(new Error('keychain full')),
      removeItem: () => Promise.resolve(),
    };
    setDeviceStoreForTesting(unwritable);
    await expect(resolveDbScope(USER_A)).resolves.toBe(scopeForUserId(USER_A));
  });
});

describe('storage names', () => {
  it('leaves the pre-accounts database where it already is', () => {
    expect(dbFileNameForScope(LEGACY_SCOPE)).toBe('macronaut.db');
    expect(idbKeyForScope(LEGACY_SCOPE)).toBe('main');
  });

  it('gives every other account its own file and record', () => {
    const scope = scopeForUserId(USER_B);
    expect(dbFileNameForScope(scope)).toBe(`macronaut-${scope}.db`);
    expect(idbKeyForScope(scope)).toBe(`main:${scope}`);
    expect(dbFileNameForScope(scope)).not.toBe(dbFileNameForScope(LEGACY_SCOPE));
    expect(idbKeyForScope(scope)).not.toBe(idbKeyForScope(LEGACY_SCOPE));
  });
});
