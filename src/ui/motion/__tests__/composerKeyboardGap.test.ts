import fs from 'node:fs';
import path from 'node:path';
import {
  COMPOSER_KEYBOARD_GAP,
  composerPad,
  composerShiftForGap,
} from '../composerKeyboardGap';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('composer keyboard gap', () => {
  it('is 10px while the keyboard is open and the resting inset otherwise', () => {
    expect(COMPOSER_KEYBOARD_GAP).toBe(10);
    expect(composerPad(true, 34)).toBe(10);
    expect(composerPad(false, 34)).toBe(34);
    expect(composerPad(false, 8)).toBe(8);
  });

  it('shifts the composer toward the keyboard by the leftover gap', () => {
    // 45px measured gap, 10px target → move 35px toward the keys.
    expect(composerShiftForGap(0, 800, 845)).toBe(35);
    // Already on target — leave the current shift alone.
    expect(composerShiftForGap(35, 835, 845)).toBe(35);
    // Overshot — ease back.
    expect(composerShiftForGap(40, 840, 845)).toBe(35);
  });

  it('docks the chat composer on that 10px gap', () => {
    const chat = read('app', 'chat', '[id].tsx');
    expect(chat).toContain('useComposerKeyboardGap');
    expect(chat).toContain('onFocus={composer.onFocus}');
    expect(chat).toContain('onBlur={composer.onBlur}');
    expect(chat).toContain('paddingBottom: composer.paddingBottom');
    expect(chat).toContain('translateY: composer.shift');
  });
});
