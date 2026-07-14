import { barcodeVariants } from './barcodeVariants';
import { NormalizedFood } from './normalize';
import { ProviderId } from './types';

/** FoodConfidenceService — a 0..1 score used internally to pick the best
 * result and to decide when to warn the user before logging. Pure. */

export interface ConfidenceContext {
  /** The scanned barcode, if this was a barcode lookup. */
  scannedBarcode?: string;
  /** The text query, if this was a search. */
  query?: string;
  /** True if another source independently returned matching nutrition. */
  corroborated?: boolean;
}

/** Base trust by source: curated/government data outranks crowd-sourced. */
const SOURCE_TRUST: Record<ProviderId, number> = {
  local: 0.95, // verbatim USDA SR, bundled + verified
  usda: 0.85, // USDA FoodData Central
  off: 0.5, // Open Food Facts (crowd-sourced)
};

export interface ConfidenceResult {
  score: number;
  reasons: string[];
}

export function scoreConfidence(food: NormalizedFood, ctx: ConfidenceContext = {}): ConfidenceResult {
  const reasons: string[] = [];
  let score = SOURCE_TRUST[food.provider];
  reasons.push(`source ${food.provider}`);

  if (ctx.scannedBarcode && food.barcode) {
    const variants = new Set(barcodeVariants(ctx.scannedBarcode));
    if (barcodeVariants(food.barcode).some((v) => variants.has(v))) {
      score += 0.15;
      reasons.push('barcode match');
    }
  }

  if (ctx.query) {
    const q = ctx.query.toLowerCase().trim();
    const name = food.name.toLowerCase();
    const brand = (food.brand ?? '').toLowerCase();
    if (name === q || brand === q) {
      score += 0.06;
      reasons.push('exact name/brand match');
    } else if (name.includes(q) || (brand && q.includes(brand))) {
      score += 0.03;
    }
  }

  const n = food.perServing ?? food.per100g;
  if (n && n.protein !== undefined && n.carbs !== undefined && n.fat !== undefined) {
    score += 0.05;
    reasons.push('complete macros');
  }
  if (food.gramsPerServing) {
    score += 0.04;
    reasons.push('serving size present');
  }
  if (food.imageUrl) score += 0.02;
  if (ctx.corroborated) {
    score += 0.1;
    reasons.push('corroborated by another source');
  }

  // Validation penalties dominate: a suspect panel can't be high confidence.
  if (food.validation.severity === 'suspect') {
    score *= 0.35;
    reasons.push('failed nutrition sanity check');
  } else if (food.validation.severity === 'warn') {
    score *= 0.8;
    reasons.push('nutrition warnings');
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/** Below this, the UI warns the user and asks them to review/edit. */
export const LOW_CONFIDENCE = 0.55;
