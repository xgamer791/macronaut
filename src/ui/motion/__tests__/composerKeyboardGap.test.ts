import fs from 'node:fs';
import path from 'node:path';
import {
  ACCESSORY_PILL_INSET,
  COMPOSER_KEYBOARD_GAP,
  COMPOSER_PILL_GAP,
  composerPad,
} from '../composerKeyboardGap';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('composer keyboard gap', () => {
  it('clears Apple’s accessory pill by 15px', () => {
    expect(COMPOSER_PILL_GAP).toBe(15);
    // The pill already floats 10pt below the viewport bottom, so the page only
    // has to supply the remaining 5pt.
    expect(ACCESSORY_PILL_INSET).toBe(10);
    expect(COMPOSER_KEYBOARD_GAP).toBe(5);
  });

  it('keeps the resting inset until the keyboard covers the home indicator', () => {
    expect(composerPad(true, 34)).toBe(COMPOSER_KEYBOARD_GAP);
    expect(composerPad(false, 34)).toBe(34);
    expect(composerPad(false, 8)).toBe(8);
  });

  it('docks the chat composer on that gap without translating it', () => {
    const chat = read('app', 'chat', '[id].tsx');
    const hook = read('ui', 'motion', 'useComposerKeyboardGap.ts');
    expect(chat).toContain('useComposerKeyboardGap');
    expect(chat).toContain('onFocus={onComposerFocus}');
    expect(chat).toContain('onBlur={onComposerBlur}');
    expect(chat).toContain('paddingBottom: composerPad');
    expect(hook).toContain('composerPad(keyboardOpen, restingPad)');
  });

  it('never measures the viewport to place the composer', () => {
    const hook = read('ui', 'motion', 'useComposerKeyboardGap.ts');
    const chat = read('app', 'chat', '[id].tsx');
    // Reading the gap back and translating by it compounded on every keyboard
    // resize and walked the composer off the bottom of the screen.
    expect(hook).not.toContain('visualViewport');
    expect(hook).not.toContain('getBoundingClientRect');
    expect(chat).not.toContain('composerShift');
    expect(chat).not.toContain('composerWrapRef');
  });
});
