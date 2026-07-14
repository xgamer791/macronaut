import { Nutrition } from '@/domain/types';

export type ProviderId = 'usda' | 'off';

/** Normalized food shape shared by all providers and the local cache. */
export interface ProviderFood {
  provider: ProviderId;
  id: string;
  name: string;
  brand?: string;
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
