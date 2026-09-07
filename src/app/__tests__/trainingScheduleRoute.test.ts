import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname, '..');

describe('training schedule route', () => {
  it('opens from the Today calendar and keeps a full calendar on the schedule', () => {
    const today = fs.readFileSync(path.join(appDir, '(tabs)', 'index.tsx'), 'utf8');
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');
    expect(today).toContain("router.push('/training-schedule')");
    expect(schedule).toContain('title="Training Schedule"');
    expect(schedule).toContain('collapseHeader={false}');
    expect(schedule).toContain('accessibilityLabel="Open full calendar"');
    expect(schedule).toContain('<MonthCalendarPopup');
    expect(schedule).toContain('const ADD_ICON_SIZE = 27');
    expect(schedule).toContain('width: ADD_ICON_SIZE');
    expect(schedule).toContain('height: ADD_ICON_SIZE');
    expect(schedule).toContain('styles.addIcon');
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
});
