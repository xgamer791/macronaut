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

  it('pours the glass from how far the page has scrolled', () => {
    expect(screen).toContain('useAnimatedScrollHandler');
    expect(screen).toContain('HEADER_GLASS_TRAVEL');
    // Clamped both ways: no negative opacity on a bounce, no overshoot.
    expect(screen).toContain('y <= 0 ? 0 : y >= HEADER_GLASS_TRAVEL ? 1');
    expect(bar).toContain('opacity: progress.value');
  });

  it('leaves the hero photo untouched until the page moves', () => {
    expect(screen).toContain('useSharedValue(0)');
  });

  it('uses a real material on every platform it can', () => {
    expect(bar).toContain('isGlassEffectAPIAvailable');
    expect(bar).toContain('GlassView');
    expect(bar).toContain('backdropFilter');
    expect(bar).toContain('WebkitBackdropFilter');
    // Nothing to blur through on the rest, so the pane goes near-opaque.
    expect(bar).toContain('solidGlass');
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
