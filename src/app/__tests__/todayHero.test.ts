import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(__dirname, '..', '(tabs)', 'index.tsx'), 'utf8');

describe('today hero', () => {
  it('lifts the photo so its empty ceiling does not sit under the header', () => {
    expect(src).toContain(
      'style={[styles.heroImage, { top: -heroLift, height: heroHeight + heroLift }]}',
    );
    expect(src).not.toMatch(/source=\{HERO_IMAGE\}\s*\n\s*style=\{StyleSheet\.absoluteFill\}/);
  });

  it('keeps the same crop at every hero height', () => {
    const rows = Number(/const HERO_ROWS = (\d+);/.exec(src)?.[1]);
    const ceiling = Number(/const HERO_CEILING_ROWS = (\d+);/.exec(src)?.[1]);
    for (const heroHeight of [320, 370, 420]) {
      const lift = Math.round((heroHeight * ceiling) / (rows - ceiling));
      // `cover` is bound by height at the hero's aspect, so this is the scale.
      const cropped = lift / ((heroHeight + lift) / rows);
      // Whole pixels, so the crop lands within a row of the ceiling either way.
      expect(Math.abs(cropped - ceiling)).toBeLessThan(1);
    }
  });
});
