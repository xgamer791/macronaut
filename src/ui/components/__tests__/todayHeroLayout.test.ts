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

  it('uses one 24px section gap above the cards, below them, and between sections', () => {
    expect(TODAY_SECTION_GAP).toBe(24);
    expect(TODAY_SECTION_GAP).toBe(spacing.xl);
    expect(HERO_GAP_BELOW_HEADER).toBe(TODAY_SECTION_GAP);
    expect(HERO_GAP_ABOVE_MACROS).toBe(TODAY_SECTION_GAP);
  });

  it('is the height both chrome files paint', () => {
    expect(read('ui', 'components', 'GlassHeaderBar.tsx')).toContain(
      'paddingTop: insets.top + HEADER_PAD_TOP',
    );
    expect(read('ui', 'components', 'AppHeader.tsx')).toContain('marginTop: HEADER_ROW_LIFT');
  });

  it('lets Screen reserve the header so the first gap cannot collapse', () => {
    const today = read('app', '(tabs)', 'index.tsx');
    expect(today).toContain('paddingTop: TODAY_SECTION_GAP');
    expect(today).toContain('paddingBottom: TODAY_SECTION_GAP');
    expect(today).toContain('gap: TODAY_SECTION_GAP');
    expect(today).toContain('paddingTop: 0');
    expect(today).toContain('flush');
    expect(today).not.toContain('overlayHeader');
    expect(today).not.toContain('todayHeroHeight');
    expect(today).not.toContain('glassHeaderHeight');
    expect(today).not.toContain('spacing.md + 15');
    expect(read('ui', 'components', 'SectionHeader.tsx')).toContain('flush = false');
  });
});
