/** Offsets at or below this are rubber-band / overscroll, not page scroll. */
export const HEADER_HIDE_TOP = 0;
/**
 * Do not start a hide until the page has moved past the rubber-band zone.
 * iOS reports noisy 10–40px offsets around 0 while the bounce settles.
 */
export const HEADER_HIDE_COMMIT = 64;
/** Ignore jitter smaller than this so a finger rest does not toggle. */
export const HEADER_HIDE_DELTA = 8;

/**
 * Down hides, up shows. Hitting the top or overscrolling never shows the
 * header — only a real upward page scroll does.
 */
export function headerHideForScroll(y: number, lastY: number, hidden: boolean): boolean {
  if (y <= HEADER_HIDE_TOP) return hidden;
  const from = Math.max(0, lastY);
  const dy = y - from;
  if (dy > HEADER_HIDE_DELTA && y >= HEADER_HIDE_COMMIT) return true;
  if (dy < -HEADER_HIDE_DELTA) return false;
  return hidden;
}

/**
 * In-flow collapse must not run during rubber-band. Follow the visual state
 * only once the page has actually moved off the top.
 */
export function headerLayoutHidden(
  y: number,
  visualHidden: boolean,
  prevLayoutHidden: boolean,
): boolean {
  if (y <= HEADER_HIDE_TOP) return prevLayoutHidden;
  if (y >= HEADER_HIDE_COMMIT) return visualHidden;
  return prevLayoutHidden;
}
