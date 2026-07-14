import { Nutrition } from '@/domain/types';

/** Provider identifiers. 'local' = bundled generic-foods dataset (no network). */
export type ProviderId = 'usda' | 'off' | 'local' | 'nutritionix' | 'fatsecret' | 'restaurant';

/** Confidence band derived from a 0..1 score. */
export type ConfidenceLevel = 'verified' | 'high' | 'review' | 'low';

/** Food category for ranking / grouping / conflict resolution. */
export type FoodCategory = 'generic' | 'packaged' | 'restaurant' | 'custom';

/** Preparation / form state inferred from names and queries. */
export type PreparationState =
  | 'raw'
  | 'cooked'
  | 'grilled'
  | 'roasted'
  | 'boiled'
  | 'pan_browned'
  | 'drained'
  | 'skin_on'
  | 'skinless'
  | 'lean_percent'
  | 'ground_beef_ratio'
  | 'unknown';

/** Map a 0..1 confidence score to a ConfidenceLevel band. */
export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.95) return 'verified';
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'review';
  return 'low';
}

/** Normalized food shape shared by all providers and the local cache. */
export interface ProviderFood {
  provider: ProviderId;
  id: string;
  name: string;
  brand?: string;
  /** Restaurant chain / venue name when category is restaurant. */
  restaurant?: string;
  barcode?: string;
  imageUrl?: string;
  /** True for non-branded/reference foods (USDA Foundation/SR). */
  isGeneric: boolean;
  /** Per 100 g when known. */
  nutritionPer100g?: Nutrition;
  /** Per labeled serving when known. */
  nutritionPerServing?: Nutrition;
  gramsPerServing?: number;
  servingLabel?: string;
  /** Raw OFF serving unit ('g' | 'ml' | 'oz' …), when provided. */
  servingUnit?: string;
  /** Inferred or provider-supplied preparation state. */
  preparationState?: PreparationState;
  /** Ingredient list when available (branded / restaurant). */
  ingredients?: string[];
  /** Allergen labels when available. */
  allergens?: string[];
  /** Curated / lab-verified flag from the source. */
  verified?: boolean;
  /** ISO date of last verification when known. */
  lastVerified?: string;
  /** USDA FoodData Central dataType (Foundation, SR Legacy, Branded, …). */
  dataType?: string;
  /** Food category for conflict / grouping. */
  category?: FoodCategory;
  // --- Enrichment set by the lookup pipeline (normalize + validate + score) ---
  /** 0..1 accuracy confidence. */
  confidence?: number;
  /** Band derived from confidence. */
  confidenceLevel?: ConfidenceLevel;
  /** What the displayed nutrition describes. */
  servingBasis?: 'serving' | '100g' | '100ml' | 'container' | 'unknown';
  /** Human-readable validation warnings (empty when clean). */
  warnings?: string[];
}

export type SearchFilter = 'all' | 'branded' | 'generic';

export interface SearchOptions {
  filter?: SearchFilter;
  limit?: number;
  signal?: AbortSignal;
}

export interface FoodProvider {
  id: ProviderId;
  search(query: string, opts?: SearchOptions): Promise<ProviderFood[]>;
  getByBarcode(code: string, signal?: AbortSignal): Promise<ProviderFood | null>;
}

/** Error carrying enough context for polished UI states. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly kind: 'network' | 'rate-limit' | 'auth' | 'bad-response',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
