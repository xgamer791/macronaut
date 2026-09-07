import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

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

type WebBox = { getBoundingClientRect: () => DOMRect };

function webBox(node: View | null): WebBox | null {
  if (!node) return null;
  const maybe = node as unknown as Partial<WebBox>;
  return typeof maybe.getBoundingClientRect === 'function' ? (maybe as WebBox) : null;
}

/** Resting pad is the home-indicator inset. While the keyboard is up that
 * inset is already covered, so the composer sits `COMPOSER_KEYBOARD_GAP`
 * above the keys — and on web, a leftover viewport gap is closed too. */
export function useComposerKeyboardGap(restingPad: number) {
  const wrapRef = useRef<View>(null);
  const openRef = useRef(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [shift, setShift] = useState(0);

  const snap = useCallback(() => {
    if (!openRef.current) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const box = webBox(wrapRef.current);
    if (!vv || !box) return;
    const viewportBottom = vv.offsetTop + vv.height;
    setShift((current) =>
      composerShiftForGap(current, box.getBoundingClientRect().bottom, viewportBottom),
    );
  }, []);

  const open = useCallback(() => {
    openRef.current = true;
    setKeyboardOpen(true);
    const later = [0, 50, 300];
    later.forEach((ms) => setTimeout(snap, ms));
  }, [snap]);

  const close = useCallback(() => {
    openRef.current = false;
    setKeyboardOpen(false);
    setShift(0);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', open);
    const hide = Keyboard.addListener('keyboardDidHide', close);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [close, open]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', snap);
    vv.addEventListener('scroll', snap);
    return () => {
      vv.removeEventListener('resize', snap);
      vv.removeEventListener('scroll', snap);
    };
  }, [snap]);

  return {
    wrapRef,
    paddingBottom: composerPad(keyboardOpen, restingPad),
    shift,
    onFocus: open,
    onBlur: close,
  };
}
