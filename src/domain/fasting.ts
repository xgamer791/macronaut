const MINUTE_MS = 60_000;

/** Start the fast immediately when the chosen start is still in the future.
 * Keeps the same duration so a just-picked window does not sit behind a
 * "starts in" countdown. Past starts (backdated fasts) stay as written. */
export function resolveFastWindow(
  startAt: number,
  endAt: number,
  now = Date.now(),
): { startAt: number; endAt: number } {
  const duration = Math.max(MINUTE_MS, endAt - startAt);
  if (startAt > now) {
    return { startAt: now, endAt: now + duration };
  }
  return { startAt, endAt };
}
