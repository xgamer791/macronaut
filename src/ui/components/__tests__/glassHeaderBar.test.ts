import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

const tokens = read('ui', 'theme', 'tokens.ts');
const bar = read('ui', 'components', 'GlassHeaderBar.tsx');
const screen = read('ui', 'components', 'Screen.tsx');
const tabBar = read('ui', 'components', 'TabBar.tsx');
const today = read('app', '(tabs)', 'index.tsx');
const trainingSchedule = read('app', 'training-schedule.tsx');
const ownProfile = read('app', 'profile.tsx');
const publicProfile = read('app', 'u', '[handle].tsx');
const profileHeader = read('ui', 'components', 'ProfileHeader.tsx');

/** Home and both profile pages keep chrome above the page, in flow, painted
 * with the same chrome as the tab bar. Source tests pin layout that no
 * logic-level test can reach. */
describe('sticky chrome headers', () => {
  it('paints the bar with the tab-bar chrome instead of overlay glass', () => {
    expect(tokens).toContain("chrome: '#FFFFFF'");
    expect(bar).toContain('backgroundColor: colors.chrome');
    expect(bar).toContain('borderBottomColor: colors.border');
    expect(tabBar).toContain('backgroundColor: colors.chrome');
    expect(tabBar).toContain('borderTopColor: colors.border');
    expect(bar).not.toContain("position: 'absolute'");
    expect(bar).not.toContain("className: 'glass'");
    expect(bar).not.toContain('data-headerglass');
  });

  it('keeps the bar above the scroll layer rather than inside the page', () => {
    expect(screen).toContain('stickyHeader');
    expect(screen).toContain('AutoHideHeader');
    expect(screen).toContain('useHeaderScrollHide');
    expect(screen).toMatch(/<ScrollView \{\.\.\.scrollProps\}>/);
    expect(screen).not.toContain('HeaderGlassProvider');
  });

  it('lets Today paint its own accent diary instead of the shared chrome bar', () => {
    expect(today).toContain('<TodayDashboard');
    expect(today).not.toContain('overlayHeader');
    expect(today).not.toContain('<GlassHeaderBar>');
    expect(today).not.toContain('<AppHeader />');
    expect(today).not.toContain('headerWrap');
    expect(today).not.toContain('heroHeight');
    expect(today).not.toContain('windowHeight * 0.42');
    expect(today).not.toContain('heroHeight + insets.top');
    expect(today).not.toContain('greetingForHour');
    expect(today).not.toContain('Good afternoon');
    expect(today).not.toContain('greetingBlock');
  });

  it('seats the schedule header in the bar rather than offsetting it by hand', () => {
    expect(trainingSchedule).toContain('<GlassHeaderBar inset={spacing.lg}>');
    expect(trainingSchedule).not.toContain('top={insets.top');
  });

  it('lifts the chrome off both profile banners exactly once', () => {
    for (const page of [ownProfile, publicProfile]) {
      expect(page).toContain('<GlassHeaderBar inset={spacing.md}>');
      expect(page).toContain('<ProfileHeaderChrome onBack=');
      expect(page).toContain('showChrome={false}');
    }
    expect(profileHeader).toContain('showChrome = true');
    expect(profileHeader).toContain('export function ProfileHeaderChrome');
    expect(profileHeader).toContain('bannerHeight + (showChrome ? insets.top : 0)');
  });
});
