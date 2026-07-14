import { barcodeVariants } from './barcodeNormalize';
import { NormalizedFood } from './normalize';
import {
  detectPreparationState,
  isMeatLike,
  preparationMatchScore,
  preparationMatches,
} from './preparation';
import {
  ConfidenceLevel,
  PreparationState,
  ProviderId,
  confidenceLevelFromScore,
} from './types';

/** FoodConfidenceService — a 0..1 score used internally to pick the best
 * result and to decide when to warn the user before logging. Pure. */

export interface ConfidenceContext {
  /** The scanned barcode, if this was a barcode lookup. */
  scannedBarcode?: string;
  /** The text query, if this was a search. */
  query?: string;
  /** True if another source independently returned matching nutrition. */
  corroborated?: boolean;
  /** Query preparation override; inferred from query when omitted. */
  queryPreparation?: PreparationState;
  /** Food preparation override; inferred from name when omitted. */
  foodPreparation?: PreparationState;
}

/** Base trust by source: curated/government data outranks crowd-sourced. */
export const SOURCE_TRUST: Record<ProviderId, number> = {
  local: 0.95, // verbatim USDA SR, bundled + verified
  restaurant: 0.92, // official / curated restaurant menus
  usda: 0.85, // USDA FoodData Central
  nutritionix: 0.8, // Nutritionix licensed DB
  fatsecret: 0.78, // FatSecret platform
  custom: 0.72, // user-submitted My Foods (known to user; not lab-verified)
  off: 0.5, // Open Food Facts (crowd-sourced)
};

export interface ConfidenceResult {
  score: number;
  reasons: string[];
  level: ConfidenceLevel;
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

  // Preparation match bonuses / penalties
  const queryPrep =
    ctx.queryPreparation ?? (ctx.query ? detectPreparationState(ctx.query) : 'unknown');
  const foodPrep = ctx.foodPreparation ?? detectPreparationState(food.name);
  const meatLike = isMeatLike(ctx.query ?? food.name);
  if (queryPrep !== 'unknown') {
    const prepScore = preparationMatchScore(queryPrep, foodPrep, { meatLike });
    if (prepScore >= 1) {
      score += 0.06;
      reasons.push('prep match');
    } else if (prepScore >= 0.5) {
      score += 0.02;
      reasons.push('soft prep match');
    } else if (!preparationMatches(queryPrep, foodPrep, { meatLike })) {
      score -= 0.2;
      reasons.push('prep mismatch');
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

  const clamped = Math.max(0, Math.min(1, score));
  return { score: clamped, reasons, level: confidenceLevelFromScore(clamped) };
}

/** Confidence band helper (re-export for call sites). */
export function confidenceLevel(score: number): ConfidenceLevel {
  return confidenceLevelFromScore(score);
}

/** Below this, the UI warns the user and asks them to review/edit.
 * Scores under 0.60 must never auto-select. */
export const LOW_CONFIDENCE = 0.6;

/** Prefer auto-select only at high confidence and above. */
export const AUTO_SELECT_CONFIDENCE = 0.8;
