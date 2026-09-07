/** Stay visible while the page is still at the top. */
export const HEADER_HIDE_TOP = 8;
/** Ignore jitter smaller than this so a finger rest does not toggle. */
export const HEADER_HIDE_DELTA = 8;

/** Facebook-style: down hides, up shows, the top of the page always shows. */
export function headerHideForScroll(y: number, lastY: number, hidden: boolean): boolean {
  if (y <= HEADER_HIDE_TOP) return false;
  const dy = y - lastY;
  if (dy > HEADER_HIDE_DELTA) return true;
  if (dy < -HEADER_HIDE_DELTA) return false;
  return hidden;
}
