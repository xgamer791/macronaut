import fs from 'node:fs';
import path from 'node:path';
import {
  HERO_GAP_ABOVE_MACROS,
  HERO_GAP_BELOW_HEADER,
  TODAY_SECTION_GAP,
  glassHeaderHeight,
} from '../todayHeroLayout';
import { spacing, touchTarget } from '@/ui/theme/tokens';

const srcDir = path.join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(srcDir, ...parts), 'utf8');

describe('today hero layout', () => {
  it('sizes the header band from the same chrome the bar paints', () => {
    expect(glassHeaderHeight(0, 1)).toBe(2 + 3 + touchTarget + spacing.xs + 1);
    expect(glassHeaderHeight(47, 1)).toBe(47 + 2 + 3 + touchTarget + spacing.xs + 1);
  });

  it('uses 30px under the header and 24px between the later sections', () => {
    expect(HERO_GAP_BELOW_HEADER).toBe(30);
    expect(TODAY_SECTION_GAP).toBe(24);
    expect(TODAY_SECTION_GAP).toBe(spacing.xl);
    expect(HERO_GAP_ABOVE_MACROS).toBe(TODAY_SECTION_GAP);
  });

  it('is the height both chrome files paint', () => {
    expect(read('ui', 'components', 'GlassHeaderBar.tsx')).toContain(
      'paddingTop: insets.top + HEADER_PAD_TOP',
    );
    expect(read('ui', 'components', 'AppHeader.tsx')).toContain('marginTop: HEADER_ROW_LIFT');
  });

  it('lets the accent diary own the first viewport instead of the old hero chrome', () => {
    const today = read('app', '(tabs)', 'index.tsx');
    expect(today).toContain('<TodayDashboard');
    expect(today).toContain('minHeight={height}');
    expect(today).toContain('flush');
    expect(today).not.toContain('overlayHeader');
    expect(today).not.toContain('todayHeroHeight');
    expect(today).not.toContain('glassHeaderHeight');
    expect(today).not.toContain('spacing.md + 15');
    expect(today).not.toContain('paddingTop: HERO_GAP_BELOW_HEADER');
    expect(read('ui', 'components', 'SectionHeader.tsx')).toContain('flush = false');
  });
});
