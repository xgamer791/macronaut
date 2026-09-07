import { spacing, touchTarget } from '@/ui/theme/tokens';

/** Extra `GlassHeaderBar` padding above the safe-area inset. */
export const HEADER_PAD_TOP = 2;
/** `AppHeader` row offset under that padding. */
export const HEADER_ROW_LIFT = 3;

/**
 * One vertical rhythm for Today: header→cards, cards→macros, and every
 * section after that. 8px under the hairline read as no gap on the dark
 * plate; 16px is the old body gap and still looked tight there. 24px is
 * the next token and is visible in every slot.
 */
export const TODAY_SECTION_GAP = spacing.xl;

/** Chrome height of the Today header: safe area + bar padding + 44px row + hairline. */
export function glassHeaderHeight(topInset: number, hairlineWidth: number) {
  return topInset + HEADER_PAD_TOP + HEADER_ROW_LIFT + touchTarget + spacing.xs + hairlineWidth;
}

/** Inset between the hairline and the metric modules. */
export const HERO_GAP_BELOW_HEADER = TODAY_SECTION_GAP;

/** Inset under the modules, above the macros section. */
export const HERO_GAP_ABOVE_MACROS = TODAY_SECTION_GAP;

/** Hero is the overlay chrome, equal insets, and the modules. */
export function todayHeroHeight(moduleSize: number, headerHeight: number) {
  return headerHeight + HERO_GAP_BELOW_HEADER + moduleSize + HERO_GAP_ABOVE_MACROS;
}
