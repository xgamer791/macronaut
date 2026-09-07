import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname, '..');

describe('training schedule route', () => {
  it('keeps the calendar and training schedule as separate destinations', () => {
    const today = fs.readFileSync(path.join(appDir, '(tabs)', 'index.tsx'), 'utf8');
    const header = fs.readFileSync(
      path.join(appDir, '..', 'ui', 'components', 'AppHeader.tsx'),
      'utf8',
    );
    const calendar = fs.readFileSync(path.join(appDir, 'calendar.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');
    expect(today).toContain('<AppHeader />');
    expect(header).toContain("router.push('/calendar')");
    expect(header).not.toContain("router.push('/training-schedule')");
    expect(layout).toContain('name="calendar" options={SLIDE_OVER_OPTIONS}');
    expect(calendar).toContain('<SlideScreen from="right">');
    expect(calendar).toContain('presentation="screen"');
    expect(calendar).toContain('dayDetail');
    expect(calendar).toContain("import { CalendarPlusIcon } from 'phosphor-react-native'");
    expect(calendar).toContain('const HEADER_ICON_SIZE = 22');
    expect(calendar).toContain('<CalendarPlusIcon size={HEADER_ICON_SIZE}');
    expect(calendar).toContain("accessibilityLabel: 'Open training schedule'");
    expect(calendar).toContain("onPress: () => router.push('/training-schedule')");
    expect(schedule).toContain('title="Training Schedule"');
    expect(schedule).toContain('collapseHeader={false}');
    expect(schedule).toContain('accessibilityLabel="Open full calendar"');
    expect(schedule).toContain('<CalendarPanel');
    expect(schedule).toContain('const ADD_ICON_SIZE = 27');
    expect(schedule).toContain('width: ADD_ICON_SIZE');
    expect(schedule).toContain('height: ADD_ICON_SIZE');
    expect(schedule).toContain('styles.addIcon');
  });

  it('uses the same outlined calendar-days glyph everywhere', () => {
    const files = [
      path.join(appDir, '..', 'ui', 'components', 'AppHeader.tsx'),
      path.join(appDir, 'training-schedule.tsx'),
      path.join(appDir, '(tabs)', 'progress.tsx'),
      path.join(appDir, 'fasting.tsx'),
      path.join(appDir, '(tabs)', 'settings.tsx'),
    ].map((file) => fs.readFileSync(file, 'utf8'));
    const icon = fs.readFileSync(
      path.join(appDir, '..', 'ui', 'components', 'CalendarIcon.tsx'),
      'utf8',
    );

    expect(icon).toContain("import { CalendarDays } from 'lucide-react-native'");
    for (const file of files) expect(file).toContain('CalendarIcon');
    expect(files.join('\n')).not.toMatch(/calendar-(?:clear-)?outline|calendar-clock/);
  });

  it('offers free-form day, workout, macro-label, and sets fields', () => {
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');
    expect(schedule).toContain('label="Training name"');
    expect(schedule).toContain('label="Workout name"');
    expect(schedule).toContain('label="Macro label"');
    expect(schedule).toContain('label="Sets / rounds"');
    expect(schedule).not.toContain('ACTIVITY_PRESETS');
  });

  it('uses a full-height right editor without a sheet, scrim, or page slide', () => {
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');

    expect(schedule).toContain('<RightEditorPanel');
    expect(schedule).toContain("position: 'absolute'");
    expect(schedule).toContain('right: 0');
    expect(schedule).toContain('bottom: 0');
    expect(schedule).not.toContain('<Sheet');
    expect(schedule).not.toContain('colors.overlay');
    expect(schedule).not.toContain('<SlideScreen');
    expect(layout).toContain(
      '<Stack.Screen name="training-schedule" options={{ animation: \'none\' }} />',
    );
  });

  it('uses direct weekday training language', () => {
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');

    expect(schedule).toContain('return `${longWeekday(date)} Training`');
    expect(schedule).toContain('No training added');
    expect(schedule).not.toContain('Shape this day your way');
    expect(schedule).not.toContain('Plan this day');
    expect(schedule).not.toContain('SPECIFIC WORKOUTS');
  });

  it('offers saved per-day repeats and one all-days toggle at the bottom', () => {
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');

    expect(schedule).toContain('title="Repeat every week"');
    expect(schedule).not.toContain('title="Repeat every day"');
    expect(schedule).not.toContain('All seven days repeat every week.');
    expect(schedule).toContain('title={`Repeat every ${longWeekday(editingDate)}`}');
    expect(schedule).toContain('useSetTrainingScheduleRepeatDay');
    expect(schedule).toContain('useSetAllTrainingScheduleRepeats');
    expect(schedule).toContain('accessibilityRole="switch"');
    expect(schedule).toContain("marginTop: 'auto'");
    expect(schedule).toContain('backgroundColor: value ? colors.accent : colors.track');
  });
});
