/**
 * Apple floats the keyboard's form-navigation pill below the bottom of the web
 * viewport, where the page cannot see or measure it. Measured on iOS (iPhone
 * 15 Pro Max, 430x932pt): the viewport ends at 519pt and the pill starts at
 * 529pt, with the same 10pt again between the pill and the keys.
 */
export const ACCESSORY_PILL_INSET = 10;

/** Space to leave between the composer and that pill. */
export const COMPOSER_PILL_GAP = 15;

/**
 * Padding under the composer while the keyboard is up. The composer's wrapper
 * is the last thing in the page, so its bottom edge already sits on the
 * viewport bottom — clearing the pill by `COMPOSER_PILL_GAP` means padding out
 * only the part of that gap the pill does not already occupy.
 */
export const COMPOSER_KEYBOARD_GAP = Math.max(COMPOSER_PILL_GAP - ACCESSORY_PILL_INSET, 0);

export function composerPad(keyboardOpen: boolean, restingPad: number): number {
  return keyboardOpen ? COMPOSER_KEYBOARD_GAP : restingPad;
}
