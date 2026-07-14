import { Nutrition } from '@/domain/types';
import { caloriesFromMacros } from '@/domain/nutrition';
import { barcodeVariants } from './barcodeNormalize';
import {
  detectPreparationState,
  isMeatLike,
  preparationMatchScore,
  preparationMatches,
} from './preparation';
import {
  ConfidenceLevel,
  PreparationState,
  ProviderFood,
  confidenceLevelFromScore,
} from './types';

export { confidenceLevelFromScore };

/** Minimum score to auto-select without forcing a review UI. */
export const AUTO_SELECT_MIN = 0.8;

/** Below this, never auto-select — UI must ask the user to review. */
export const RANK_LOW_CONFIDENCE = 0.6;

export interface RankContext {
  query?: string;
  scannedBarcode?: string;
  /** Query preparation override; inferred from query when omitted. */
  queryPreparation?: PreparationState;
  /** True when another source independently corroborated nutrition. */
  corroborated?: boolean;
}

export interface RankedFood {
  food: ProviderFood;
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
  /** True when score >= AUTO_SELECT_MIN. */
  autoSelect: boolean;
}

function hasCompleteNutrition(n: Nutrition | undefined): boolean {
  if (!n) return false;
  return n.protein !== undefined && n.carbs !== undefined && n.fat !== undefined;
}

function macrosInconsistent(n: Nutrition | undefined): boolean {
  if (!n || n.calories <= 0) return false;
  if (n.protein === undefined && n.carbs === undefined && n.fat === undefined) return false;
  const derived = caloriesFromMacros(n.protein ?? 0, n.carbs ?? 0, n.fat ?? 0);
  return Math.abs(n.calories - derived) / n.calories > 0.3;
}

function identityKey(food: ProviderFood): string {
  if (food.barcode) {
    const v = barcodeVariants(food.barcode);
    return `bc:${v.sort()[0] ?? food.barcode}`;
  }
  const prep = food.preparationState ?? detectPreparationState(food.name);
  return `n:${food.name.toLowerCase().trim()}|${(food.brand ?? food.restaurant ?? '').toLowerCase().trim()}|${prep}`;
}

/** Pure ranking score for a single food against lookup context. */
export function rankScore(food: ProviderFood, ctx: RankContext = {}): RankedFood {
  const reasons: string[] = [];
  let score = food.confidence ?? 0.5;

  const query = ctx.query?.toLowerCase().trim() ?? '';
  const meatLike = query ? isMeatLike(query) : isMeatLike(food.name);
  const queryPrep =
    ctx.queryPreparation ?? (query ? detectPreparationState(query) : 'unknown');
  const foodPrep = food.preparationState ?? detectPreparationState(food.name);

  // Exact name
  if (query && food.name.toLowerCase().trim() === query) {
    score += 0.12;
    reasons.push('exact name');
  } else if (query && food.name.toLowerCase().includes(query)) {
    score += 0.04;
    reasons.push('name contains query');
  }

  // Brand / restaurant
  if (query && food.brand && food.brand.toLowerCase().trim() === query) {
    score += 0.08;
    reasons.push('exact brand');
  }
  if (query && food.restaurant && food.restaurant.toLowerCase().includes(query)) {
    score += 0.1;
    reasons.push('restaurant match');
  }

  // Barcode
  if (ctx.scannedBarcode && food.barcode) {
    const scanned = new Set(barcodeVariants(ctx.scannedBarcode));
    if (barcodeVariants(food.barcode).some((v) => scanned.has(v))) {
      score += 0.15;
      reasons.push('barcode match');
    }
  }

  // Preparation
  const prepScore = preparationMatchScore(queryPrep, foodPrep, { meatLike });
  if (queryPrep !== 'unknown') {
    if (prepScore >= 1) {
      score += 0.08;
      reasons.push('exact prep match');
    } else if (prepScore >= 0.5) {
      score += 0.03;
      reasons.push('soft prep match');
    } else if (!preparationMatches(queryPrep, foodPrep, { meatLike })) {
      score -= 0.25;
      reasons.push('raw/cooked mismatch');
    }
  }

  // Completeness
  const panel = food.nutritionPerServing ?? food.nutritionPer100g;
  if (hasCompleteNutrition(panel)) {
    score += 0.05;
    reasons.push('complete nutrition');
  } else {
    score -= 0.08;
    reasons.push('missing nutrition');
  }

  if (food.gramsPerServing && food.gramsPerServing > 0) {
    score += 0.04;
    reasons.push('serving weight');
  } else {
    score -= 0.06;
    reasons.push('missing serving weight');
  }

  if (food.verified) {
    score += 0.08;
    reasons.push('verified');
  }
  if (food.lastVerified) {
    const ageMs = Date.now() - Date.parse(food.lastVerified);
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 1000 * 60 * 60 * 24 * 365) {
      score += 0.03;
      reasons.push('recent verification');
    }
  }

  // Penalties
  if (food.provider === 'off' && !food.verified) {
    score -= 0.05;
    reasons.push('user-submitted source');
  }
  if (macrosInconsistent(panel)) {
    score -= 0.15;
    reasons.push('inconsistent macros');
  }
  if (food.warnings && food.warnings.length > 0) {
    score -= Math.min(0.2, food.warnings.length * 0.04);
  }

  score = Math.max(0, Math.min(1, score));
  const level = confidenceLevelFromScore(score);
  return {
    food: { ...food, confidence: score, confidenceLevel: level },
    score,
    level,
    reasons,
    autoSelect: score >= AUTO_SELECT_MIN,
  };
}

/** Rank a list; optionally drop exact identity duplicates keeping the best. */
export function rankFoods(foods: ProviderFood[], ctx: RankContext = {}): RankedFood[] {
  const ranked = foods.map((f) => rankScore(f, ctx));
  ranked.sort((a, b) => b.score - a.score);

  // Duplicate penalty: demote subsequent same-identity entries
  const seen = new Set<string>();
  for (const r of ranked) {
    const key = identityKey(r.food);
    if (seen.has(key)) {
      r.score = Math.max(0, r.score - 0.12);
      r.reasons.push('duplicate');
      r.level = confidenceLevelFromScore(r.score);
      r.autoSelect = r.score >= AUTO_SELECT_MIN;
      r.food = { ...r.food, confidence: r.score, confidenceLevel: r.level };
    } else {
      seen.add(key);
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export function shouldAutoSelect(score: number): boolean {
  return score >= AUTO_SELECT_MIN;
}

export function neverAutoSelect(score: number): boolean {
  return score < RANK_LOW_CONFIDENCE;
}
