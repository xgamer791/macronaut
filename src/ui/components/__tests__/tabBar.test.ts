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
    expect(tabBar).toContain('chatbubbles-outline');
    expect(tabBar).toContain("label: 'Friends'");
    expect(tabBar).toContain("label: 'Groups'");
    expect(tabBar).toContain('people-circle-outline');
    expect(tabBar).not.toContain("href: '/notifications'");
    expect(tabBar).toContain('Open your profile');
    expect(tabBar).toContain('size={ICON}');
    expect(tabBar).toContain('const ICON = 27');
    expect(tabBar).toContain('const AVATAR = 32');
    expect(tabBar).toContain('useMyProfile');
    expect(tabBar).toContain('avatarUrl');
    expect(tabBar).not.toContain('restaurant');
    expect(tabBar).not.toContain('settings-outline');
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
