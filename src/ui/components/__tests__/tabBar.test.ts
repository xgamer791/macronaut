import fs from 'node:fs';
import path from 'node:path';

const tabBar = fs.readFileSync(path.join(__dirname, '..', 'TabBar.tsx'), 'utf8');

describe('tab bar', () => {
  it('is Today, chats, groups, notifications, then the profile picture', () => {
    const items = tabBar.slice(tabBar.indexOf('const ITEMS'));
    const today = items.indexOf("name: 'index'");
    const chats = items.indexOf("href: '/chats'");
    const groups = items.indexOf("name: 'progress'");
    const notify = items.indexOf("href: '/notifications'");
    const profile = items.indexOf("kind: 'profile'");
    expect(today).toBeGreaterThan(-1);
    expect(today).toBeLessThan(chats);
    expect(chats).toBeLessThan(groups);
    expect(groups).toBeLessThan(notify);
    expect(notify).toBeLessThan(profile);
    expect(tabBar).toContain('router.push(item.href)');
    expect(tabBar).toContain("router.push('/profile')");
    expect(tabBar).toContain('chatbubbles-outline');
    expect(tabBar).toContain('Open your profile');
    expect(tabBar).toContain('size={ICON}');
    expect(tabBar).toContain('const ICON = 27');
    expect(tabBar).toContain('const AVATAR = 32');
    expect(tabBar).toContain('useMyProfile');
    expect(tabBar).toContain('avatarUrl');
    expect(tabBar).not.toContain('restaurant');
    expect(tabBar).not.toContain('settings-outline');
  });
});
