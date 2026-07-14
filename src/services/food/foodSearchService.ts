import { FoodRepo } from '@/repositories/foodRepo';
import { CachedFood } from '@/repositories/types';
import { offProvider } from './openFoodFacts';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';
import { usdaProvider } from './usda';

export interface SearchResult {
  foods: ProviderFood[];
  /** Providers that failed (results may be partial). */
  failures: { provider: string; kind: ProviderError['kind'] }[];
  /** True when every provider failed. */
  allFailed: boolean;
}

/** Layered search across providers: USDA leads (generic + branded, rich
 * micros), Open Food Facts supplements (branded/international + images).
 * Results are deduped and written into the local cache so previously seen
 * foods stay available offline. Providers are pluggable — add one to the
 * array and searches include it. */
export function createFoodSearchService(
  foodRepo: FoodRepo,
  providers: FoodProvider[] = [usdaProvider, offProvider],
) {
  async function cache(foods: ProviderFood[]): Promise<void> {
    const now = new Date().toISOString();
    for (const f of foods) {
      const record: CachedFood = {
        provider: f.provider,
        providerId: f.id,
        name: f.name,
        brand: f.brand,
        barcode: f.barcode,
        imageUrl: f.imageUrl,
        gramsPerServing: f.gramsPerServing,
        servingQty: 1,
        servingUnit: f.servingLabel,
        nutritionPer100g: f.nutritionPer100g,
        nutritionPerServing: f.nutritionPerServing,
        flagged: false,
        cachedAt: now,
      };
      await foodRepo.upsertCachedFood(record).catch(() => {
        // Cache writes must never break search results.
      });
    }
  }

  function dedupe(foods: ProviderFood[]): ProviderFood[] {
    const seen = new Set<string>();
    const out: ProviderFood[] = [];
    for (const f of foods) {
      const key =
        f.barcode?.replace(/^0+/, '') ||
        `${f.name.toLowerCase().trim()}|${(f.brand ?? '').toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  }

  return {
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
      const results = await Promise.allSettled(providers.map((p) => p.search(query, opts)));
      const foods: ProviderFood[] = [];
      const failures: SearchResult['failures'] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') foods.push(...r.value);
        else {
          const err = r.reason;
          failures.push({
            provider: providers[i].id,
            kind: err instanceof ProviderError ? err.kind : 'network',
          });
        }
      });
      const deduped = dedupe(foods);
      cache(deduped); // fire-and-forget
      return { foods: deduped, failures, allFailed: failures.length === providers.length };
    },

    /** Barcode resolution order: local custom foods → local cache →
     * providers (OFF first — it's barcode-native). */
    async lookupBarcode(code: string, signal?: AbortSignal): Promise<{
      custom?: string;
      food?: ProviderFood;
      offline: boolean;
    }> {
      const custom = await foodRepo.findCustomByBarcode(code);
      if (custom) return { custom: custom.id, offline: false };

      const cached = await foodRepo.findCachedByBarcode(code);
      if (cached) {
        return {
          food: {
            provider: cached.provider,
            id: cached.providerId,
            name: cached.name,
            brand: cached.brand,
            barcode: cached.barcode,
            imageUrl: cached.imageUrl,
            isGeneric: false,
            nutritionPer100g: cached.nutritionPer100g,
            nutritionPerServing: cached.nutritionPerServing,
            gramsPerServing: cached.gramsPerServing,
            servingLabel: cached.servingUnit,
          },
          offline: false,
        };
      }

      const ordered = [...providers].sort((a) => (a.id === 'off' ? -1 : 1));
      let sawNetworkFailure = false;
      for (const p of ordered) {
        try {
          const food = await p.getByBarcode(code, signal);
          if (food) {
            await cache([food]);
            return { food, offline: false };
          }
        } catch (err) {
          if (err instanceof ProviderError && err.kind === 'network') sawNetworkFailure = true;
        }
      }
      return { offline: sawNetworkFailure };
    },
  };
}

export type FoodSearchService = ReturnType<typeof createFoodSearchService>;
