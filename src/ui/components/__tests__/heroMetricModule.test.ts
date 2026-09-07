import fs from 'node:fs';
import path from 'node:path';

const moduleSrc = fs.readFileSync(path.join(__dirname, '..', 'HeroMetricModule.tsx'), 'utf8');
const catalog = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'data', 'heroMetrics.ts'), 'utf8');

describe('steps hero icon', () => {
  it('uses the catalog footsteps glyph instead of the walking stick figure', () => {
    expect(catalog).toContain("id: 'steps'");
    expect(catalog).toContain("icon: 'footsteps-outline'");
    expect(catalog).not.toContain("icon: 'walk-outline'");
    expect(moduleSrc).toContain("heroMetricDef('steps').icon");
    expect(moduleSrc).not.toContain('walk-outline');
  });
});
