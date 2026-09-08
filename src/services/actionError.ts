import { ConvexError } from 'convex/values';

/** Keeps backend diagnostics out of app screens while preserving deliberate,
 * user-facing application errors sent as ConvexError data. */
export function friendlyActionError(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === 'string' && error.data.trim()) {
    return error.data.trim();
  }

  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }

  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/network|failed to fetch|connection|offline/i.test(raw)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return fallback;
}
