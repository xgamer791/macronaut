import { Nutrition } from '@/domain/types';
import { FoodCategory, ProviderFood, ProviderId } from './types';

/** Conflict resolution — never average competing nutrition panels.
 * Returns a single winner plus an optional notice when peers disagree significantly. */

export interface ConflictCandidate {
  food: ProviderFood;
  /** True when this hit came from a barcode lookup (not text search). */
  barcodeMatch?: boolean;
  /** ISO timestamp used for "newest verified" tie-break. */
  verifiedAt?: string;
}

export interface ConflictResult {
  winner: ProviderFood;
  /** Present when at least one peer differs significantly from the winner. */
  conflictNotice?: string;
  rejected: ProviderFood[];
}

const CATEGORY_PRIORITY: Record<FoodCategory, number> = {
  packaged: 4,
  restaurant: 3,
  generic: 2,
  custom: 1,
};

/** Provider preference within a category (higher wins). */
const PROVIDER_PRIORITY: Record<ProviderId, number> = {
  custom: 7, // user's own food wins barcode/identity conflicts for them
  local: 6,
  restaurant: 5,
  usda: 4,
  nutritionix: 3,
  fatsecret: 2,
  off: 1,
};

function inferCategory(food: ProviderFood): FoodCategory {
  if (food.category) return food.category;
  if (food.provider === 'custom') return 'custom';
  if (food.provider === 'restaurant' || food.restaurant) return 'restaurant';
  if (food.provider === 'local' || food.isGeneric) return 'generic';
  if (food.brand || food.barcode || food.provider === 'off' || food.provider === 'nutritionix') {
    return 'packaged';
  }
  return 'generic';
}

function panel(food: ProviderFood): Nutrition | undefined {
  return food.nutritionPer100g ?? food.nutritionPerServing;
}

/** True when calorie or macro deltas between two panels are large enough to surface. */
export function significantNutritionConflict(a: Nutrition, b: Nutrition): boolean {
  const calA = a.calories;
  const calB = b.calories;
  if (calA > 0 && calB > 0) {
    const calDelta = Math.abs(calA - calB) / Math.max(calA, calB);
    if (calDelta >= 0.2) return true;
  }
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined || vb === undefined) continue;
    const denom = Math.max(Math.abs(va), Math.abs(vb), 1);
    if (Math.abs(va - vb) / denom >= 0.25) return true;
  }
  return false;
}

function verifiedTs(c: ConflictCandidate): number {
  const iso = c.verifiedAt ?? c.food.lastVerified;
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function scoreCandidate(c: ConflictCandidate): number {
  const cat = inferCategory(c.food);
  let score = CATEGORY_PRIORITY[cat] * 100;
  score += PROVIDER_PRIORITY[c.food.provider] * 10;

  // Category-specific winners
  if (cat === 'packaged' && (c.food.brand || c.food.provider === 'off' || c.food.provider === 'nutritionix')) {
    score += 50; // manufacturer / branded wins for packaged
  }
  if (cat === 'restaurant' && (c.food.provider === 'restaurant' || c.food.verified)) {
    score += 50; // official restaurant wins
  }
  if (cat === 'generic' && (c.food.provider === 'usda' || c.food.provider === 'local')) {
    score += 50; // USDA wins for generic
  }

  if (c.barcodeMatch || (c.food.barcode && c.food.barcode.length > 0)) {
    // Barcode match beats text search — callers should set barcodeMatch for true hits.
    score += c.barcodeMatch ? 80 : 5;
  }

  if (c.food.verified) score += 20;
  score += Math.min(30, verifiedTs(c) / 1e11); // tiny newest-verified nudge
  if (c.food.confidence !== undefined) score += c.food.confidence * 10;

  return score;
}

/** Pick a single winner among candidates. Never averages nutrition. */
export function resolveConflicts(candidates: ConflictCandidate[]): ConflictResult | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { winner: candidates[0].food, rejected: [] };
  }

  const ranked = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const winner = ranked[0].food;
  const rejected = ranked.slice(1).map((c) => c.food);

  const winPanel = panel(winner);
  let conflictNotice: string | undefined;
  if (winPanel) {
    for (const peer of rejected) {
      const p = panel(peer);
      if (p && significantNutritionConflict(winPanel, p)) {
        conflictNotice = `Nutrition differs across sources for “${winner.name}”; using ${winner.provider} data.`;
        break;
      }
    }
  }

  return { winner, conflictNotice, rejected };
}
