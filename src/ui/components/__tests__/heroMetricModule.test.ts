import fs from 'node:fs';
import path from 'node:path';

const moduleSrc = fs.readFileSync(path.join(__dirname, '..', 'HeroMetricModule.tsx'), 'utf8');
const catalog = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'data', 'heroMetrics.ts'),
  'utf8',
);

describe('steps hero icon', () => {
  it('uses the catalog footsteps glyph instead of the walking stick figure', () => {
    expect(catalog).toContain("id: 'steps'");
    expect(catalog).toContain("icon: 'footsteps-outline'");
    expect(catalog).not.toContain("icon: 'walk-outline'");
    expect(moduleSrc).toContain("heroMetricDef('steps').icon");
    expect(moduleSrc).not.toContain('walk-outline');
  });
});

describe('fasting hero module', () => {
  it('offers an active, complete, and ready timer treatment', () => {
    expect(catalog).toContain("id: 'fasting'");
    expect(catalog).toContain("kind: 'fasting'");
    expect(catalog).toContain("icon: 'timer-outline'");
    expect(moduleSrc).toContain('function FastingInner');
    expect(moduleSrc).toContain("values.detail === 'Fasting now'");
    expect(moduleSrc).toContain("values.detail === 'Fast complete'");
    expect(moduleSrc).toContain('no active fast');
    expect(moduleSrc).toContain('Start from + menu');
    expect(moduleSrc).toContain('LIVE');
  });
});
