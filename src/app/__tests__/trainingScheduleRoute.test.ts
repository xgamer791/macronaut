import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname, '..');

describe('training schedule route', () => {
  it('opens from the Today calendar and keeps a full calendar on the schedule', () => {
    const today = fs.readFileSync(path.join(appDir, '(tabs)', 'index.tsx'), 'utf8');
    const schedule = fs.readFileSync(path.join(appDir, 'training-schedule.tsx'), 'utf8');
    expect(today).toContain("router.push('/training-schedule')");
    expect(schedule).toContain('title="Training Schedule"');
    expect(schedule).toContain('accessibilityLabel="Open full calendar"');
    expect(schedule).toContain('<MonthCalendarPopup');
    expect(schedule).toContain("name={plan ? 'chevron-forward' : 'add-circle-outline'}");
    expect(schedule).toContain('size={plan ? 20 : 30}');
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
