import fs from 'node:fs';
import path from 'node:path';
import {
  HEADER_HIDE_COMMIT,
  HEADER_HIDE_DELTA,
  HEADER_HIDE_TOP,
  headerHideForScroll,
  headerLayoutHidden,
} from '../headerAutoHideLogic';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('headerHideForScroll', () => {
  it('keeps the header up while the page is still at the top', () => {
    expect(headerHideForScroll(0, 0, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_TOP, 0, true)).toBe(false);
    expect(headerHideForScroll(-12, 40, true)).toBe(false);
  });

  it('does not treat rubber-band recovery as a downward hide flick', () => {
    expect(headerHideForScroll(24, -30, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_COMMIT - 1, 0, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_COMMIT, 0, false)).toBe(true);
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

describe('headerLayoutHidden', () => {
  it('freezes in-flow collapse in the rubber-band zone until scroll settles', () => {
    expect(headerLayoutHidden(0, false, true, false)).toBe(true);
    expect(headerLayoutHidden(0, false, true, true)).toBe(false);
    expect(headerLayoutHidden(20, true, false, false)).toBe(false);
    expect(headerLayoutHidden(80, true, false, false)).toBe(true);
    expect(headerLayoutHidden(80, false, true, false)).toBe(false);
  });
});

describe('header auto-hide wiring', () => {
  it('keeps the same bezier as the stack-page slide for header hide', () => {
    const hide = read('ui', 'motion', 'headerAutoHide.tsx');
    expect(hide).toContain("from './SlideScreen'");
    expect(hide).toContain("from './headerAutoHideLogic'");
    expect(hide).toContain('HEADER_HIDE_DURATION_MS = SLIDE_DURATION_MS');
    expect(hide).toContain('SLIDE_DURATION_MS');
    expect(hide).toContain('SLIDE_EASING');
    expect(hide).toContain("dataSet: { headerhide: hidden ? 'out' : 'in' }");
    expect(hide).toContain('marginBottom: collapsed ? -height : 0');
    expect(hide).toContain('transform: [{ translateY: offset }]');
    expect(hide).toContain('Math.max(0, y)');
    expect(hide).toContain('HEADER_LAYOUT_SETTLE_MS');
    expect(hide).not.toContain('styles.clip');
    expect(hide).not.toContain("height: hidden ? 0 : height");
  });

  it('drives Today and both profile headers from Screen scroll', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('useHeaderScrollHide');
    expect(screen).toContain('AutoHideHeader');
    expect(screen).toContain('onScroll: hideOnScroll ? hide.onScroll');
    expect(screen).toContain('onMomentumScrollEnd: hideOnScroll ? hide.onScrollSettle');
    expect(screen).toContain('onScrollEndDrag: hideOnScroll ? hide.onScrollSettle');
    expect(screen).toContain('collapsed={hide.collapsed}');
    expect(screen).toContain('collapseHeader');
    expect(read('app', '(tabs)', 'index.tsx')).toContain('stickyHeader={');
    expect(read('app', 'profile.tsx')).toContain('stickyHeader={');
    expect(read('app', 'u', '[handle].tsx')).toContain('stickyHeader={');
    expect(read('app', 'training-schedule.tsx')).toContain('collapseHeader={false}');
    expect(read('app', 'fasting.tsx')).toContain('collapseHeader={false}');
  });
});
