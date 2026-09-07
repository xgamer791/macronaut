import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

const bar = read('ui', 'components', 'GlassHeaderBar.tsx');
const screen = read('ui', 'components', 'Screen.tsx');
const today = read('app', '(tabs)', 'index.tsx');
const ownProfile = read('app', 'profile.tsx');
const publicProfile = read('app', 'u', '[handle].tsx');
const profileHeader = read('ui', 'components', 'ProfileHeader.tsx');

/** Home and both profile pages float their chrome on a glass bar that stays
 * put while the page scrolls under it. Source tests are how this repo pins
 * layout that no logic-level test can reach. */
describe('sticky glass headers', () => {
  it('pins the bar above the scroll layer rather than inside the page', () => {
    expect(bar).toContain("position: 'absolute'");
    expect(bar).toContain('top: 0');
    expect(screen).toContain('stickyHeader');
    // The header is a sibling of the ScrollView, so scrolling cannot move it.
    expect(screen).toMatch(/<\/Animated\.ScrollView>\s*\n\s*<HeaderGlassProvider/);
  });

  it('keeps the glass at full strength so backdrop-filter can see the page', () => {
    // Opacity on an ancestor flattens the blur into a solid strip.
    expect(bar).not.toContain('opacity: progress.value');
    expect(bar).not.toContain('useAnimatedStyle');
    expect(bar).toContain("className: 'glass'");
  });

  it('uses the 2025–26 liquid-glass recipe on the sticky header', () => {
    expect(bar).toContain("className: 'glass'");
    expect(bar).toContain("data-headerglass");
    expect(bar).toContain('GLASS_RADIUS = 24');
    expect(bar).not.toContain('GlassView');
    expect(bar).not.toContain('blur(28px)');
    const html = read('app', '+html.tsx');
    expect(html).toContain('.glass');
    expect(html).toContain('[data-headerglass]');
    expect(html).toContain('blur(26px) saturate(140%)');
    expect(html).toContain('border-radius: 24px');
    expect(html).toContain('rgba(10, 12, 20, 0.630)');
    expect(html).toContain('mix-blend-mode: screen');
    expect(html).toContain('inset 0 0 0 0.5px rgba(255, 255, 255, 0.070)');
    expect(html).toContain('background: rgba(10, 12, 20, 1.000)');
  });

  it('hands Today its header instead of drawing one inside the hero', () => {
    expect(today).toContain('stickyHeader={');
    expect(today).toContain('<GlassHeaderBar>');
    expect(today).toContain('<AppHeader onCalendarPress');
    expect(today).not.toContain('headerWrap');
  });

  it('drops the calendar clear of the bar', () => {
    expect(today).toContain('top={insets.top + 64}');
  });

  it('lifts the chrome off both profile banners exactly once', () => {
    for (const page of [ownProfile, publicProfile]) {
      expect(page).toContain('<GlassHeaderBar inset={spacing.md}>');
      expect(page).toContain('<ProfileHeaderChrome onBack=');
      expect(page).toContain('showChrome={false}');
    }
    expect(profileHeader).toContain('showChrome = true');
    expect(profileHeader).toContain('export function ProfileHeaderChrome');
  });
});
