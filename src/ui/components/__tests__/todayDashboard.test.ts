import fs from 'node:fs';
import path from 'node:path';

const dash = fs.readFileSync(path.join(__dirname, '..', 'TodayDashboard.tsx'), 'utf8');
const today = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'app', '(tabs)', 'index.tsx'),
  'utf8',
);
const preview = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'app', 'preview-today.tsx'),
  'utf8',
);

describe('Today mint diary', () => {
  it('clones the reference chrome: sprout, date nav, remaining ring, macros', () => {
    expect(dash).toContain('SproutLogo');
    expect(dash).toContain('Remaining');
    expect(dash).toContain('Consumed');
    expect(dash).toContain('Burned');
    expect(dash).toContain('Goal ');
    expect(dash).toContain('kcal');
    expect(dash).toContain('macro.label');
    expect(today).toContain('<TodayDashboard');
    expect(today).toContain('formatDiaryNavLabel');
    expect(today).toContain("label: 'Carbs'");
    expect(today).toContain("label: 'Protein'");
    expect(today).toContain("label: 'Fat'");
    expect(today).not.toContain('HeroMetricModule');
    expect(today).not.toContain('hero-gym');
    expect(today).not.toContain('MACRO_IMAGES');
  });

  it('keeps an ungated preview with the reference numbers', () => {
    expect(preview).toContain('dateLabel="TODAY, 15 JUL"');
    expect(preview).toContain('remaining={14779}');
    expect(preview).toContain('goal={14779}');
    expect(preview).toContain('target: 185');
    expect(preview).toContain('target: 74');
    expect(preview).toContain('target: 49');
    expect(preview).toContain('9:41');
  });
});
