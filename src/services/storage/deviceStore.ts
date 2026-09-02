/** Small async key-value store for device-local values that must survive a
 * reload but must never live in the app database: the Supabase session and the
 * mapping from account to local database scope.
 *
 * Native uses expo-secure-store (Keychain / EncryptedSharedPreferences); web
 * uses localStorage, which is the only option a static GitHub Pages build has.
 * Values written on web are therefore readable by anything with script access
 * to the origin — see docs/security.md. */
export interface DeviceStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** SecureStore rejects values over 2048 bytes on Android, and a Supabase
 * session (access + refresh token + user payload) regularly exceeds that, so
 * every value is written as a manifest plus fixed-size chunks. */
const CHUNK_SIZE = 1600;
const MANIFEST_PREFIX = 'chunks:';

function assertKey(key: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new Error(`Invalid device store key: ${key}`);
  }
}

function chunk(value: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  return parts.length > 0 ? parts : [''];
}

function parseManifest(raw: string | null): number | null {
  if (!raw || !raw.startsWith(MANIFEST_PREFIX)) return null;
  const count = Number.parseInt(raw.slice(MANIFEST_PREFIX.length), 10);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function createWebStore(): DeviceStore {
  // Static web export prerenders routes in Node, where there is no window.
  function ls(): Storage | null {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
      return null;
    }
  }

  return {
    async getItem(key) {
      assertKey(key);
      return ls()?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      assertKey(key);
      ls()?.setItem(key, value);
    },
    async removeItem(key) {
      assertKey(key);
      ls()?.removeItem(key);
    },
  };
}

function createSecureStore(): DeviceStore {
  // Required lazily so the web bundle never pulls in the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');

  async function clearChunks(key: string, count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  }

  return {
    async getItem(key) {
      assertKey(key);
      const count = parseManifest(await SecureStore.getItemAsync(key));
      if (count === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        // A missing chunk means a half-written value; treat it as absent
        // rather than handing back a truncated session.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      assertKey(key);
      const previous = parseManifest(await SecureStore.getItemAsync(key));
      const parts = chunk(value);
      for (let i = 0; i < parts.length; i += 1) {
        await SecureStore.setItemAsync(`${key}.${i}`, parts[i]);
      }
      await SecureStore.setItemAsync(key, `${MANIFEST_PREFIX}${parts.length}`);
      if (previous !== null && previous > parts.length) {
        for (let i = parts.length; i < previous; i += 1) {
          await SecureStore.deleteItemAsync(`${key}.${i}`);
        }
      }
    },

    async removeItem(key) {
      assertKey(key);
      const count = parseManifest(await SecureStore.getItemAsync(key));
      await SecureStore.deleteItemAsync(key);
      if (count !== null) await clearChunks(key, count);
    },
  };
}

let store: DeviceStore | null = null;

export function getDeviceStore(): DeviceStore {
  if (!store) {
    // Required lazily so tests (and any pure-logic import of this module) do
    // not have to load react-native.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    store = Platform.OS === 'web' ? createWebStore() : createSecureStore();
  }
  return store;
}

/** Test seam. */
export function setDeviceStoreForTesting(next: DeviceStore | null): void {
  store = next;
}

/** In-memory implementation used by tests and as a last-resort fallback. */
export function createMemoryDeviceStore(): DeviceStore {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      assertKey(key);
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      assertKey(key);
      map.set(key, value);
    },
    async removeItem(key) {
      assertKey(key);
      map.delete(key);
    },
  };
}
