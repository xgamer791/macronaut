import { spacing, touchTarget } from '@/ui/theme/tokens';

/** Extra `GlassHeaderBar` padding above the safe-area inset. */
export const HEADER_PAD_TOP = 2;
/** `AppHeader` row offset under that padding. */
export const HEADER_ROW_LIFT = 3;

/** Chrome height of the Today header: safe area + bar padding + 44px row + hairline. */
export function glassHeaderHeight(topInset: number, hairlineWidth: number) {
  return topInset + HEADER_PAD_TOP + HEADER_ROW_LIFT + touchTarget + spacing.xs + hairlineWidth;
}

/** Tight inset between the hairline and the metric modules. */
export const HERO_GAP_BELOW_HEADER = spacing.sm;

/** Inset under the modules, above the macros section. */
export const HERO_GAP_ABOVE_MACROS = spacing.md + 15;

/** Hero is only as tall as the overlay chrome, the modules, and the two insets. */
export function todayHeroHeight(moduleSize: number, headerHeight: number) {
  return headerHeight + HERO_GAP_BELOW_HEADER + moduleSize + HERO_GAP_ABOVE_MACROS;
}
