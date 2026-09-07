import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

const panel = read('ui', 'components', 'CalendarPanel.tsx');
const html = read('app', '+html.tsx');
const index = read('ui', 'components', 'index.ts');

/** The calendar is one component shared by Today, Progress, Fasting and the
 * training schedule. Layout it in source, since no logic-level test renders it. */
describe('calendar panel', () => {
  it('is the app’s only month calendar', () => {
    expect(index).toContain("export { CalendarPanel } from './CalendarPanel';");
    expect(fs.existsSync(path.join(srcDir, 'ui', 'components', 'MonthCalendarPopup.tsx'))).toBe(
      false,
    );
    for (const page of [
      read('ui', 'components', 'DashboardHeader.tsx'),
      read('app', 'fasting.tsx'),
      read('app', 'training-schedule.tsx'),
      read('app', '(tabs)', 'progress.tsx'),
    ]) {
      expect(page).toContain('<CalendarPanel');
      expect(page).not.toContain('MonthCalendarPopup');
    }
  });

  it('fills the screen from the right edge on the shared slide curve', () => {
    expect(panel).toContain("import { usePushWhileOpen } from '@/ui/motion/SlidePush';");
    expect(panel).toContain(
      "import { SLIDE_DURATION_MS, SLIDE_EASING } from '@/ui/motion/slideTiming';",
    );
    expect(panel).toContain('usePushWhileOpen(open, { x: -panelWidth });');
    expect(panel).toContain('transform: [{ translateX: (1 - progress.value) * panelWidth }]');
    expect(panel).toContain('width: panelWidth');
    expect(panel).toContain('right: 0');
    // No scrim and no floating card: the panel is the screen.
    expect(panel).not.toContain('GlassPopup');
    expect(panel).not.toContain('colors.overlay');
    expect(panel).not.toContain('top?: number');
  });

  it('drives the same slide from CSS on the web', () => {
    expect(panel).toContain("dataSet: { calendarpanel: open ? 'open' : 'shut' }");
    expect(panel).toContain("dataSet: { calendarsheet: '' }");
    expect(html).toContain('[data-calendarpanel] [data-calendarsheet]');
    expect(html).toContain('transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1);');
  });

  it('draws days as outlined circles, the weekday row under the grid', () => {
    expect(panel).toContain('borderRadius: circle / 2');
    expect(panel).toContain('borderColor: ring');
    expect(panel).toContain('backgroundColor: isSelected ? colors.accent');
    expect(panel).toContain('styles.todayDot');
    // Grid first, weekday labels after it — the reverse of a stock calendar.
    expect(panel.indexOf('styles.grid')).toBeLessThan(panel.indexOf('styles.weekdayRow'));
    expect(panel).toContain('weekdayShortLabels');
  });

  it('carries the month stepper, month and year pickers, and the legend', () => {
    expect(panel).toContain('accessibilityLabel="Previous month"');
    expect(panel).toContain('accessibilityLabel="Next month"');
    expect(panel).toContain('label={monthLabel(month)}');
    expect(panel).toContain('label={String(yearOf(month))}');
    expect(panel).toContain('function Dropdown(');
    expect(panel).toContain('Tracked');
    expect(panel).toContain('Untracked');
  });

  it('paints from theme tokens rather than fixed colors', () => {
    expect(panel).toContain('const { colors } = useTheme();');
    expect(panel).toContain('backgroundColor: colors.background');
    expect(panel).toContain('backgroundColor: colors.surfaceRaised');
    expect(panel).toContain('colors.borderStrong');
    expect(panel).not.toMatch(/#[0-9a-fA-F]{6}'/);
  });
});
