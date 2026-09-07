import { useCallback, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { composerPad } from './composerKeyboardGap';

/**
 * Resting pad is the home-indicator inset. While the keyboard is up that inset
 * is already covered, so the composer tucks down far enough to clear Apple's
 * accessory pill and no further.
 *
 * Nothing here measures the viewport. An earlier version translated the
 * composer by the gap it read back off the visible viewport, but the read
 * happened before the previous translation had painted, so every keyboard
 * resize added the same correction again and walked the composer off the
 * bottom of the screen.
 */
export function useComposerKeyboardGap(restingPad: number) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const open = useCallback(() => setKeyboardOpen(true), []);
  const close = useCallback(() => setKeyboardOpen(false), []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', open);
    const hide = Keyboard.addListener('keyboardDidHide', close);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [close, open]);

  return {
    paddingBottom: composerPad(keyboardOpen, restingPad),
    onFocus: open,
    onBlur: close,
  };
}
