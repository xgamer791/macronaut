import { ConvexReactClient, type ConvexReactClientOptions } from 'convex/react';

/** Expo inlines `EXPO_PUBLIC_*` at build time, so this must stay a static
 * property access. The deploy workflow supplies it from `npx convex deploy`;
 * locally it comes from the `.env.local` that `npx convex dev` writes. */
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

export type ConvexConfigStatus =
  | { ok: true; url: string }
  | { ok: false; message: string };

export function convexConfigStatus(): ConvexConfigStatus {
  const url = (CONVEX_URL ?? '').trim();
  if (!url) {
    return {
      ok: false,
      message:
        'EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` for local development; deploys set it from `npx convex deploy`.',
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: `EXPO_PUBLIC_CONVEX_URL is not a valid URL: ${url}` };
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    return { ok: false, message: 'EXPO_PUBLIC_CONVEX_URL must use https.' };
  }
  return { ok: true, url };
}

/** The minimal surface repositories need, so tests can supply a fake. */
export interface ConvexCaller {
  query: ConvexReactClient['query'];
  mutation: ConvexReactClient['mutation'];
  action: ConvexReactClient['action'];
}

let client: ConvexReactClient | null = null;

/** Shared by `getConvexClient` and the unit test that locks these choices.
 * JWT lifetime stays the Convex Auth default (one hour). */
export const convexClientOptions = {
  // The default hooks window.beforeunload, which React Native lacks and a
  // diary app has no unsaved-form state to protect anyway.
  unsavedChangesWarning: false,
  // Default Convex Auth behavior force-refreshes — and rotates the refresh
  // token — on every launch. Closing the app during that handshake leaves
  // the stored refresh token stale; the next open then looks like reuse and
  // the session is destroyed. Reuse the cached one-hour JWT and refresh it
  // when it is actually about to expire.
  initialAuthTokenReuse: true,
} satisfies ConvexReactClientOptions;

/** Process-wide client. Opening the WebSocket is a side effect, so callers
 * must not create it while the static web export prerenders in Node. */
export function getConvexClient(): ConvexReactClient {
  if (!client) {
    const status = convexConfigStatus();
    if (!status.ok) throw new Error(status.message);
    client = new ConvexReactClient(status.url, convexClientOptions);
  }
  return client;
}

/** Test seam. */
export function setConvexClientForTesting(next: ConvexReactClient | null): void {
  client = next;
}
