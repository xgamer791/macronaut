import fs from 'node:fs';
import path from 'node:path';
import {
  HEADER_HIDE_DELTA,
  HEADER_HIDE_TOP,
  headerHideForScroll,
} from '../headerAutoHideLogic';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('headerHideForScroll', () => {
  it('keeps the header up while the page is still at the top', () => {
    expect(headerHideForScroll(0, 0, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_TOP, 0, true)).toBe(false);
    expect(headerHideForScroll(-12, 40, true)).toBe(false);
  });

  it('hides on a downward flick and shows on an upward one', () => {
    expect(headerHideForScroll(80, 80 - (HEADER_HIDE_DELTA + 1), false)).toBe(true);
    expect(headerHideForScroll(40, 40 + (HEADER_HIDE_DELTA + 1), true)).toBe(false);
  });

  it('ignores jitter smaller than the delta', () => {
    expect(headerHideForScroll(60, 60 - (HEADER_HIDE_DELTA - 1), false)).toBe(false);
    expect(headerHideForScroll(60, 60 + (HEADER_HIDE_DELTA - 1), true)).toBe(true);
  });
});

describe('header auto-hide wiring', () => {
  it('keeps the 840ms bezier for header hide', () => {
    const hide = read('ui', 'motion', 'headerAutoHide.tsx');
    expect(hide).toContain("from './SlideScreen'");
    expect(hide).toContain("from './headerAutoHideLogic'");
    expect(hide).toContain('HEADER_HIDE_DURATION_MS = 840');
    expect(hide).toContain('SLIDE_EASING');
    expect(hide).toContain("dataSet: { headerhide: hidden ? 'out' : 'in' }");
  });

  it('drives Today and both profile headers from Screen scroll', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('useHeaderScrollHide');
    expect(screen).toContain('AutoHideHeader');
    expect(screen).toContain('onScroll: stickyHeader ? hide.onScroll');
    expect(read('app', '(tabs)', 'index.tsx')).toContain('stickyHeader={');
    expect(read('app', 'profile.tsx')).toContain('stickyHeader={');
    expect(read('app', 'u', '[handle].tsx')).toContain('stickyHeader={');
  });
});
