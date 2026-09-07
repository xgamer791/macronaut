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

  it('docks the shared composer on that gap without translating it', () => {
    const composer = read('ui', 'chat', 'MessageComposer.tsx');
    const hook = read('ui', 'motion', 'useComposerKeyboardGap.ts');
    expect(composer).toContain('useComposerKeyboardGap');
    expect(composer).toContain('onFocus={onComposerFocus}');
    expect(composer).toContain('onBlur={onComposerBlur}');
    expect(composer).toContain('paddingBottom: composerPad');
    expect(hook).toContain('composerPad(keyboardOpen, restingPad)');
    // Both conversations sit on that one composer rather than their own.
    expect(read('app', 'chat', '[id].tsx')).toContain('<MessageComposer');
    expect(read('app', 'group-chat', '[id].tsx')).toContain('<MessageComposer');
  });

  it('never measures the viewport to place the composer', () => {
    const hook = read('ui', 'motion', 'useComposerKeyboardGap.ts');
    const composer = read('ui', 'chat', 'MessageComposer.tsx');
    // Reading the gap back and translating by it compounded on every keyboard
    // resize and walked the composer off the bottom of the screen.
    expect(hook).not.toContain('visualViewport');
    expect(hook).not.toContain('getBoundingClientRect');
    expect(composer).not.toContain('composerShift');
    expect(composer).not.toContain('composerWrapRef');
  });
});
