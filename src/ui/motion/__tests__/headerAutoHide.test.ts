import fs from 'node:fs';
import path from 'node:path';
import {
  HEADER_HIDE_COMMIT,
  HEADER_HIDE_DELTA,
  headerHideForScroll,
} from '../headerAutoHideLogic';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('headerHideForScroll', () => {
  it('does not show the header just because the page hit the top or overscrolled', () => {
    expect(headerHideForScroll(0, 0, false)).toBe(false);
    expect(headerHideForScroll(0, 80, true)).toBe(true);
    expect(headerHideForScroll(-12, 40, true)).toBe(true);
    expect(headerHideForScroll(0, -20, true)).toBe(true);
  });

  it('does not treat rubber-band recovery as a hide or a show', () => {
    expect(headerHideForScroll(24, -30, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_COMMIT - 1, 0, false)).toBe(false);
    expect(headerHideForScroll(HEADER_HIDE_COMMIT, 0, false)).toBe(true);
  });

  it('hides on a downward flick and shows only on an upward one', () => {
    expect(headerHideForScroll(80, 80 - (HEADER_HIDE_DELTA + 1), false)).toBe(true);
    expect(headerHideForScroll(40, 40 + (HEADER_HIDE_DELTA + 1), true)).toBe(false);
    expect(headerHideForScroll(40, 40 + (HEADER_HIDE_DELTA + 1), false)).toBe(false);
  });

  it('ignores jitter smaller than the delta', () => {
    expect(headerHideForScroll(80, 80 - (HEADER_HIDE_DELTA - 1), false)).toBe(false);
    expect(headerHideForScroll(80, 80 + (HEADER_HIDE_DELTA - 1), true)).toBe(true);
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
    expect(hide).toContain('if (y < HEADER_HIDE_TOP) return');
    expect(hide).not.toContain('settleAtTop');
    expect(hide).not.toContain('HEADER_LAYOUT_SETTLE_MS');
    expect(hide).not.toContain('styles.clip');
    expect(hide).not.toContain('height: hidden ? 0 : height');
  });

  it('floats the slab over the page and only ever translates it', () => {
    const hide = read('ui', 'motion', 'headerAutoHide.tsx');
    expect(hide).toContain("position: 'absolute'");
    expect(hide).toContain('transform: [{ translateY: -progress.value * (height || 0) }]');
    // Nothing may resize the slab or the page as the header leaves.
    expect(hide).not.toContain('marginBottom');
    expect(hide).not.toContain('collapsed');
  });

  it('reserves the header band with padding that never changes on scroll', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('onHeight={setHeaderHeight}');
    expect(screen).toContain(
      'hideOnScroll && !overlay ? { paddingTop: headerHeight } : null',
    );
    expect(screen).toContain('contentContainerStyle: [contentPad, style, headerPad]');
    expect(screen).not.toContain('collapsed={hide.collapsed}');
  });

  it('only lifts the slab out of flow once its height is known', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('floating={overlay || headerHeight > 0}');
    expect(screen).toContain('if (hideOnScroll && (overlay || headerHeight > 0))');
  });

  it('keeps overlayHeader available but Today uses the reserved band', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('overlayHeader');
    expect(screen).toContain('overlay = Boolean(hideOnScroll && overlayHeader)');
    expect(read('app', '(tabs)', 'index.tsx')).not.toContain('overlayHeader');
  });

  it('drives Today and both profile headers from Screen scroll', () => {
    const screen = read('ui', 'components', 'Screen.tsx');
    expect(screen).toContain('useHeaderScrollHide');
    expect(screen).toContain('AutoHideHeader');
    expect(screen).toContain('onScroll: hideOnScroll ? hide.onScroll');
    expect(screen).toContain('collapseHeader');
    expect(read('app', '(tabs)', 'index.tsx')).toContain('stickyHeader={');
    expect(read('app', 'profile.tsx')).toContain('stickyHeader={');
    expect(read('app', 'u', '[handle].tsx')).toContain('stickyHeader={');
    expect(read('app', 'training-schedule.tsx')).toContain('collapseHeader={false}');
    expect(read('app', 'fasting.tsx')).toContain('collapseHeader={false}');
  });
});
