/** Space between the chat composer and Apple’s keyboard once the field is focused. */
export const COMPOSER_KEYBOARD_GAP = 10;

export function composerPad(keyboardOpen: boolean, restingPad: number): number {
  return keyboardOpen ? COMPOSER_KEYBOARD_GAP : restingPad;
}

/**
 * How far to translate the composer so the gap from its bottom edge to the
 * visible viewport bottom (the top of the keyboard) is `COMPOSER_KEYBOARD_GAP`.
 * Positive moves it toward the keyboard.
 */
export function composerShiftForGap(
  currentShift: number,
  composerBottom: number,
  viewportBottom: number,
  targetGap: number = COMPOSER_KEYBOARD_GAP,
): number {
  const extra = viewportBottom - composerBottom - targetGap;
  if (Math.abs(extra) < 0.5) return currentShift;
  return currentShift + extra;
}
