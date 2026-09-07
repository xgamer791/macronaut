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
    expect(schedule).toContain('label="Day label"');
    expect(schedule).toContain('label="Workout label"');
    expect(schedule).toContain('label="Macro label"');
    expect(schedule).toContain('label="Sets / rounds"');
    expect(schedule).not.toContain('ACTIVITY_PRESETS');
  });
});
