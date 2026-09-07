import fs from 'node:fs';
import path from 'node:path';

const header = fs.readFileSync(path.join(__dirname, '..', 'AppHeader.tsx'), 'utf8');

describe('Today header hamburger', () => {
  it('puts a menu control on the left and keeps add and calendar on the right', () => {
    expect(header).toContain("name=\"menu-outline\"");
    expect(header).toContain('const MENU = 30');
    expect(header).toContain('size={MENU}');
    expect(header).toContain('Open menu');
    expect(header).toContain('Close menu');
    expect(header).toContain("justifyContent: 'space-between'");
    expect(header.indexOf('menu-outline')).toBeLessThan(header.indexOf('Add food'));
    expect(header.indexOf('Add food')).toBeLessThan(header.indexOf('Open calendar'));
  });

  it('opens and closes on the same friends-feed curve', () => {
    expect(header).toContain('SLIDE_DURATION_MS');
    expect(header).toContain('SLIDE_EASING');
    expect(header).toContain('withTiming');
    expect(header).toContain('visible={mounted}');
    expect(header).toContain("dataSet: { headermenu: open ? 'open' : 'shut' }");
    expect(header).not.toContain('Animated.timing');
    expect(header).not.toContain('useNativeDriver');
    expect(header).not.toContain('DRAWER_MS');
  });

  it('opens a left drawer of pages that are not in the tab bar', () => {
    expect(header).toContain('<HeaderMenu');
    expect(header).toContain("href: '/settings'");
    expect(header).toContain("href: '/meals'");
    expect(header).toContain("href: '/goals'");
    expect(header).toContain("href: '/apple-health'");
    expect(header).toContain("href: '/privacy'");
    expect(header).toContain("href: '/terms'");
    expect(header).not.toContain("href: '/chats'");
    expect(header).not.toContain("href: '/notifications'");
    expect(header).not.toContain("href: '/profile'");
  });
});
