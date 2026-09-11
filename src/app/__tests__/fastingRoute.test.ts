import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const projectDir = path.join(appDir, '..', '..');

describe('home tools and fasting route', () => {
  it('keeps the tools launcher for fasting without parking it on the accent diary', () => {
    const home = fs.readFileSync(path.join(appDir, '(tabs)', 'index.tsx'), 'utf8');
    const launcher = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'ToolLauncher.tsx'),
      'utf8',
    );
    const screen = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'Screen.tsx'), 'utf8');

    expect(home).not.toContain('floatingOverlay={<ToolLauncher />}');
    expect(home).toContain('<TodayDashboard');
    expect(screen).toContain('floatingOverlay?: React.ReactNode');
    expect(launcher).toContain('Animated.timing');
    expect(launcher).toContain("href: '/fasting'");
    expect(launcher).not.toContain("href: '/add'");
    expect(launcher).not.toContain("href: '/activity'");
    expect(launcher).not.toContain("title: 'Log food'");
    expect(launcher).not.toContain("title: 'Log activity'");
    expect(launcher).toContain('const MENU_HEIGHT = 132');
    expect(launcher).toContain('accessibilityState={{ expanded: open }}');
    expect(launcher).toContain('FAB_ABOVE_FOOTER = 20');
    expect(launcher).toContain('bottom: FAB_ABOVE_FOOTER');
    expect(launcher).not.toContain('insets.bottom');
    expect(launcher).not.toContain('boxShadow');
    expect(launcher).not.toContain('shadowOpacity');
    expect(launcher).not.toContain('elevation');
    expect(launcher).toContain('width: 48');
    expect(launcher).toContain('height: 48');
  });

  it('registers a themed fasting screen with exact dates, times, and the requested presets', () => {
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');
    const page = fs.readFileSync(path.join(appDir, 'fasting.tsx'), 'utf8');

    expect(layout).toContain('name="fasting"');
    expect(page).toContain("{ label: '8 hours', minutes: 8 * 60 }");
    expect(page).toContain("{ label: '12 hours', minutes: 12 * 60 }");
    expect(page).toContain("{ label: '1 day', minutes: 24 * 60 }");
    expect(page).toContain("{ label: '2 days', minutes: 2 * 24 * 60 }");
    expect(page).toContain("{ label: '3 days', minutes: 3 * 24 * 60 }");
    expect(page).toContain('collapseHeader={false}');
    expect(page).toContain('CalendarPanel');
    expect(page).toContain('TimePickerSheet');
    expect(page).toContain('colors.accent');
    expect(page).not.toContain('initialMode="light"');
    expect(page).not.toContain('#1877F2');
  });

  it('derives the running clock from durable account timestamps and limits custom slots to ten', () => {
    const page = fs.readFileSync(path.join(appDir, 'fasting.tsx'), 'utf8');
    const backend = fs.readFileSync(path.join(projectDir, 'convex', 'fasting.ts'), 'utf8');
    const schema = fs.readFileSync(path.join(projectDir, 'convex', 'schema.ts'), 'utf8');
    const account = fs.readFileSync(path.join(projectDir, 'convex', 'account.ts'), 'utf8');

    expect(page).toContain('activeStartAt');
    expect(page).toContain('activeEndAt');
    expect(page).toContain('resolveFastWindow');
    expect(page).toContain('Date.now()');
    expect(page).toContain('setInterval');
    expect(page).toContain("AppState.addEventListener('change'");
    expect(page).toContain('elapsed');
    expect(page).not.toContain('starts in');
    expect(page).not.toContain('FAST SCHEDULED');
    expect(page).not.toContain('Math.ceil(date.getMinutes()');
    expect(backend).toContain('MAX_CUSTOM_SLOTS = 10');
    expect(backend).toContain("query('fastingStates')");
    expect(schema).toContain('fastingStates: defineTable');
    expect(schema).toContain(".index('by_user', ['userId'])");
    expect(account).toContain(".query('fastingStates')");
  });
});
