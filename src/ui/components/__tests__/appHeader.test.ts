import fs from 'node:fs';
import path from 'node:path';

const header = fs.readFileSync(path.join(__dirname, '..', 'AppHeader.tsx'), 'utf8');

describe('Today header hamburger', () => {
  it('puts a menu control on the left and keeps add, calendar, then notifications on the right', () => {
    expect(header).toContain('<Menu size={MENU}');
    expect(header).toContain('<CalendarDays size={GLYPH}');
    expect(header).toContain('<BellIcon');
    expect(header).toContain('const MENU = 30');
    expect(header).toContain('size={MENU}');
    expect(header).toContain('Open menu');
    expect(header).toContain('Close menu');
    expect(header).toContain("justifyContent: 'space-between'");
    expect(header.indexOf('<Menu')).toBeLessThan(header.indexOf('Add food'));
    expect(header.indexOf('Add food')).toBeLessThan(header.indexOf('Open calendar'));
    expect(header.indexOf('Open calendar')).toBeLessThan(header.indexOf('<HeaderNotifyButton'));
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

  it('stretches the drawer to 20px short of the full viewport width', () => {
    expect(header).toContain('const MENU_EDGE_GAP = 20');
    expect(header).toContain('const panelWidth = Math.max((width || 390) - MENU_EDGE_GAP, 0)');
    expect(header).toContain('width: panelWidth');
  });
});
