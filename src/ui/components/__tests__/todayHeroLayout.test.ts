import fs from 'node:fs';
import path from 'node:path';
import {
  HERO_GAP_ABOVE_MACROS,
  HERO_GAP_BELOW_HEADER,
  glassHeaderHeight,
  todayHeroHeight,
} from '../todayHeroLayout';
import { spacing, touchTarget } from '@/ui/theme/tokens';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('today hero layout', () => {
  it('sizes the header band from the same chrome the bar paints', () => {
    expect(glassHeaderHeight(0, 1)).toBe(2 + 3 + touchTarget + spacing.xs + 1);
    expect(glassHeaderHeight(47, 1)).toBe(47 + 2 + 3 + touchTarget + spacing.xs + 1);
  });

  it('keeps the modules just under the hairline', () => {
    expect(HERO_GAP_BELOW_HEADER).toBe(spacing.sm);
    expect(HERO_GAP_ABOVE_MACROS).toBe(spacing.md + 15);
    const header = glassHeaderHeight(0, 1);
    const moduleSize = 173;
    expect(todayHeroHeight(moduleSize, header)).toBe(
      header + spacing.sm + moduleSize + spacing.md + 15,
    );
    // Visible gap under the overlay chrome is only the tight inset.
    expect(todayHeroHeight(moduleSize, header) - header - moduleSize - (spacing.md + 15)).toBe(
      spacing.sm,
    );
  });

  it('is the height both chrome files paint', () => {
    expect(read('ui', 'components', 'GlassHeaderBar.tsx')).toContain(
      'paddingTop: insets.top + HEADER_PAD_TOP',
    );
    expect(read('ui', 'components', 'AppHeader.tsx')).toContain('marginTop: HEADER_ROW_LIFT');
    expect(read('app', '(tabs)', 'index.tsx')).toContain('todayHeroHeight(');
    expect(read('app', '(tabs)', 'index.tsx')).toContain('overlayHeader');
  });
});
