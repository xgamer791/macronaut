/** Stay visible while the page is still at the top. */
export const HEADER_HIDE_TOP = 8;
/**
 * Do not start a hide until the page has moved past the rubber-band zone.
 * iOS reports noisy 10–40px offsets around 0 while the bounce settles.
 */
export const HEADER_HIDE_COMMIT = 64;
/** Ignore jitter smaller than this so a finger rest does not toggle. */
export const HEADER_HIDE_DELTA = 8;
/** Wait for bounce scroll events to stop before changing header layout at the top. */
export const HEADER_LAYOUT_SETTLE_MS = 64;

/** Facebook-style: down hides, up shows, the top of the page always shows.
 * Overscroll and the first pixels off the top do not count as a hide flick. */
export function headerHideForScroll(y: number, lastY: number, hidden: boolean): boolean {
  if (y <= HEADER_HIDE_TOP) return false;
  const from = Math.max(0, lastY);
  if (from <= HEADER_HIDE_TOP && y < HEADER_HIDE_COMMIT) return false;
  const dy = y - from;
  if (dy > HEADER_HIDE_DELTA) return true;
  if (dy < -HEADER_HIDE_DELTA) return false;
  return hidden;
}

/**
 * In-flow collapse (negative margin) must not run while iOS is rubber-banding
 * near the top — changing the scrollport mid-bounce is what makes it hitch.
 */
export function headerLayoutHidden(
  y: number,
  visualHidden: boolean,
  prevLayoutHidden: boolean,
  settled: boolean,
): boolean {
  if (y <= HEADER_HIDE_TOP) return settled ? false : prevLayoutHidden;
  if (y > HEADER_HIDE_COMMIT) return visualHidden;
  return prevLayoutHidden;
}
