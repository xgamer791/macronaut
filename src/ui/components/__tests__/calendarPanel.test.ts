import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

const panel = read('ui', 'components', 'CalendarPanel.tsx');
const html = read('app', '+html.tsx');
const index = read('ui', 'components', 'index.ts');

/** The calendar is one component shared by its route, Progress, Fasting and
 * the training schedule. Layout it in source, since no logic-level test renders it. */
describe('calendar panel', () => {
  it('is the app’s only month calendar', () => {
    expect(index).toContain("export { CalendarPanel } from './CalendarPanel';");
    expect(fs.existsSync(path.join(srcDir, 'ui', 'components', 'MonthCalendarPopup.tsx'))).toBe(
      false,
    );
    for (const page of [
      read('app', 'calendar.tsx'),
      read('ui', 'components', 'DashboardHeader.tsx'),
      read('app', 'fasting.tsx'),
      read('app', '(tabs)', 'progress.tsx'),
    ]) {
      expect(page).toContain('<CalendarPanel');
      expect(page).not.toContain('MonthCalendarPopup');
    }
  });

  it('can fill its own route without a modal covering the persistent footer', () => {
    const route = read('app', 'calendar.tsx');
    expect(route).toContain('presentation="screen"');
    expect(panel).toContain("presentation?: 'modal' | 'screen'");
    expect(panel).toContain('<CalendarHost embedded={embedded}');
    expect(panel).toContain('if (embedded) return <>{children}</>');
  });

  it('lets the calendar route replace Today with its schedule action', () => {
    const route = read('app', 'calendar.tsx');
    expect(route).toContain('headerAction={{');
    expect(panel).toContain('headerAction ? (');
    expect(panel).toContain('accessibilityLabel={headerAction.accessibilityLabel}');
    expect(panel).toContain('headerAction.onPress()');
    expect(panel).toContain('style={styles.headerActionSlot}');
    expect(panel).toContain('width: touchTarget');
    // Date-picker versions keep the familiar fallback.
    expect(panel).toContain('accessibilityLabel="Jump to today"');
  });

  it('fills the screen from the right edge on the shared slide curve', () => {
    expect(panel).toContain("import { usePushWhileOpen } from '@/ui/motion/SlidePush';");
    expect(panel).toContain(
      "import { SLIDE_DURATION_MS, SLIDE_EASING } from '@/ui/motion/slideTiming';",
    );
    expect(panel).toContain('usePushWhileOpen(!embedded && open, { x: -panelWidth });');
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

  it('draws days as calorie progress rings, with the weekday row under the grid', () => {
    expect(panel).toContain("import Svg, { Circle as SvgCircle } from 'react-native-svg';");
    expect(panel).toContain('<CalorieDayRing');
    expect(panel).toContain('strokeDashoffset={circumference * (1 - clamped)}');
    expect(panel).toContain('color={colors.accent}');
    expect(panel).not.toContain('backgroundColor: isSelected ? colors.accent');
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
    expect(panel).toContain('Goal progress');
    expect(panel).toContain('Goal reached');
  });

  it('paints from theme tokens rather than fixed colors', () => {
    expect(panel).toContain('const { colors } = useTheme();');
    expect(panel).toContain('backgroundColor: colors.background');
    expect(panel).toContain('backgroundColor: colors.surfaceRaised');
    expect(panel).toContain('colors.track');
    expect(panel).not.toMatch(/#[0-9a-fA-F]{6}'/);
  });
});

const detail = read('ui', 'components', 'CalendarDayDetail.tsx');
const dashboard = read('ui', 'components', 'DashboardHeader.tsx');
const queries = read('state', 'queries.ts');

/** The day section under the calendar. Its numbers all come from hooks that
 * already exist, so the checks here are that it reads them rather than
 * inventing any. */
describe('calendar day detail', () => {
  it('opens under the calendar for the screens that browse days, not the pickers', () => {
    expect(dashboard).toContain('dayDetail');
    // A date picker has no business carrying a day report.
    expect(read('app', 'fasting.tsx')).not.toContain('dayDetail');
    expect(read('app', '(tabs)', 'progress.tsx')).not.toContain('dayDetail');
  });

  it('keeps the panel open on a pick so days can be stepped through', () => {
    expect(dashboard).toContain('const selectDay = useCallback((next: DayKey) => changeDate(next)');
  });

  it('replaces the glass day summary it supersedes', () => {
    expect(fs.existsSync(path.join(srcDir, 'ui', 'components', 'DayInfoPopup.tsx'))).toBe(false);
    expect(dashboard).not.toContain('DayInfoPopup');
    expect(index).not.toContain('DayInfoPopup');
  });

  it('scrolls the calendar and the day together', () => {
    expect(panel).toContain('<ScrollView');
    expect(panel).toContain('<CalendarDayDetail date={selected} />');
  });

  it('lays the day out in four tabs', () => {
    expect(detail).toContain("{ value: 'macros', label: 'Macros' }");
    expect(detail).toContain("{ value: 'meals', label: 'Meals' }");
    expect(detail).toContain("{ value: 'training', label: 'Training' }");
    expect(detail).toContain("{ value: 'recovery', label: 'Recovery' }");
    expect(detail).toContain('accessibilityRole="tablist"');
    expect(detail).toContain('accessibilityRole="tab"');
  });

  it('cross-fades rather than swapping the numbers under the reader', () => {
    // Double-buffered: what is read is `shown`, never the incoming prop.
    expect(detail).toContain('const [pending, setPending] = useState<DayView | null>(null);');
    expect(detail).toContain('<DayTab date={shown.date} tab={shown.tab} />');
    expect(detail).toContain('runOnJS(setShown)(pending);');
    expect(detail).toContain('opacity: fade.value');
    expect(detail).toContain('FADE_OUT_MS');
    expect(detail).toContain('FADE_IN_MS');
  });

  it('reads every number from a real query rather than inventing one', () => {
    for (const hook of [
      'useDayProgress',
      'useDiaryEntries',
      'useActivityEntries',
      'useTrainingSchedule',
      'useDayNotes',
      'useMealCategories',
      'useDayType',
    ]) {
      expect(detail).toContain(hook);
      expect(queries).toContain(`export function ${hook}(`);
    }
  });

  it('says sleep is not connected instead of drawing a number for it', () => {
    expect(detail).toContain('Apple Health');
    expect(detail).not.toMatch(/sleepHours|hoursSlept|Math\.random/);
  });

  it('refills the rings and bars per day rather than once per screen', () => {
    expect(detail).toContain('BarEntranceProvider');
    expect(detail).toContain('pageKey={`calendar-day:${shown.date}:${shown.tab}`}');
  });
});
