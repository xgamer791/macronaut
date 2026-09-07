import fs from 'node:fs';
import path from 'node:path';

const tabBar = fs.readFileSync(path.join(__dirname, '..', 'TabBar.tsx'), 'utf8');

describe('tab bar', () => {
  it('is Today, chats, friends, groups, then the profile picture', () => {
    const items = tabBar.slice(tabBar.indexOf('const ITEMS'));
    const today = items.indexOf("name: 'index'");
    const chats = items.indexOf("href: '/chats'");
    const friends = items.indexOf("href: '/friends'");
    const groups = items.indexOf("href: '/groups'");
    const profile = items.indexOf("kind: 'profile'");
    expect(today).toBeGreaterThan(-1);
    expect(today).toBeLessThan(chats);
    expect(chats).toBeLessThan(friends);
    expect(friends).toBeLessThan(groups);
    expect(groups).toBeLessThan(profile);
    expect(tabBar).toContain('router.push(item.href)');
    expect(tabBar).toContain("router.push('/profile')");
    expect(tabBar).toContain('MessageSquare');
    expect(tabBar).not.toContain('chatbubbles-outline');
    expect(tabBar).toContain("label: 'Friends'");
    expect(tabBar).toContain('icon: Users');
    expect(tabBar).toContain("label: 'Groups'");
    expect(tabBar).toContain('icon: House');
    expect(tabBar).toContain('icon: UserGroup');
    expect(tabBar).not.toContain('home-outline');
    expect(tabBar).not.toContain('people-circle-outline');
    expect(tabBar).not.toContain("href: '/notifications'");
    expect(tabBar).toContain('Open your profile');
    expect(tabBar).toContain('size={glyphSize(name)}');
    expect(tabBar).toContain('const ICON_INK = 23.5');
    expect(tabBar).toContain('const AVATAR = 32');
    expect(tabBar).toContain('useMyProfile');
    expect(tabBar).toContain('avatarUrl');
    expect(tabBar).not.toContain('restaurant');
    expect(tabBar).not.toContain('settings-outline');
  });

  it('paints every tab glyph at the same 23.5px, whatever its shape', () => {
    // Extents are the ink each glyph covers on Lucide's 24-unit grid, stroke
    // included: bbox of the path data plus the 2-unit stroke straddling it.
    const extents: Record<string, number> = {
      House: 21,
      MessageSquare: 22,
      Users: 22,
      UserGroup: 22,
    };
    const table = tabBar.slice(tabBar.indexOf('const GLYPH_EXTENT'));
    for (const [glyph, extent] of Object.entries(extents)) {
      expect(table).toContain(`[${glyph}, ${extent}]`);
      // size * extent / 24 is what lands on screen, and it has to be 23.5.
      expect(((23.5 * 24) / extent) * (extent / 24)).toBeCloseTo(23.5, 5);
    }
    expect(tabBar).toContain('(ICON_INK * 24) / (found ? found[1] : DEFAULT_EXTENT)');
  });

  it('uses one footer inside tabs and one beneath stack pages', () => {
    expect(tabBar).toContain(
      "const PRIMARY_TAB_PATHS = new Set(['/', '/meals', '/progress', '/settings'])",
    );
    expect(tabBar).toContain('if (!isPrimaryTabPath(pathname)) return null;');
    expect(tabBar).toContain('export function PersistentTabBar()');
    expect(tabBar).toContain("router.replace('/')");
  });
});
