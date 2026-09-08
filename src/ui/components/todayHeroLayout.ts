import { spacing, touchTarget } from '@/ui/theme/tokens';

/** Extra `GlassHeaderBar` padding above the safe-area inset. */
export const HEADER_PAD_TOP = 2;
/** `AppHeader` row offset under that padding. */
export const HEADER_ROW_LIFT = 3;

/**
 * Vertical rhythm for Today after the hero cards. 8px under the hairline
 * read as no gap; 16px still looked tight there. 24px is the section
 * token for cards→macros and every section after that.
 *
 * Today does not overlay the header. `Screen` reserves the painted bar,
 * and the hero applies `HERO_GAP_BELOW_HEADER` above the modules so the
 * header→cards space cannot collapse when chrome height is guessed wrong.
 */
export const TODAY_SECTION_GAP = spacing.xl;

/** Chrome height of the Today header: safe area + bar padding + 44px row + hairline. */
export function glassHeaderHeight(topInset: number, hairlineWidth: number) {
  return topInset + HEADER_PAD_TOP + HEADER_ROW_LIFT + touchTarget + spacing.xs + hairlineWidth;
}

/** Inset between the hairline and the metric modules. */
export const HERO_GAP_BELOW_HEADER = 30;

/** Inset under the modules, above the macros section. */
export const HERO_GAP_ABOVE_MACROS = TODAY_SECTION_GAP;
