import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';
import { composerPad, composerShiftForGap } from './composerKeyboardGap';

type WebBox = { getBoundingClientRect: () => DOMRect };

function webBox(node: View | null): WebBox | null {
  if (!node) return null;
  const maybe = node as unknown as Partial<WebBox>;
  return typeof maybe.getBoundingClientRect === 'function' ? (maybe as WebBox) : null;
}

/** Resting pad is the home-indicator inset. While the keyboard is up that
 * inset is already covered, so the composer sits 10px above the keys — and
 * on web, a leftover viewport gap is closed too. */
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
    [0, 50, 300].forEach((ms) => setTimeout(snap, ms));
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
