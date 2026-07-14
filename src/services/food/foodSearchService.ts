import { FoodRepo } from '@/repositories/foodRepo';
import { CachedFood, CustomFood } from '@/repositories/types';
import { AUTO_SELECT_CONFIDENCE, confidenceLevel, LOW_CONFIDENCE, scoreConfidence } from './confidence';
import { resolveConflicts } from './conflict';
import { fatsecretProvider } from './fatsecret';
import { getGenericFood, searchGenericFoods } from './genericFoods';
import { GroupedFoods, groupRankedFoods } from './grouping';
import { mergeBestImage, nutritionAgrees } from './merge';
import { barcodeVariants, normalizeBarcode } from './barcodeNormalize';
import { NormalizedFood, normalizeFood } from './normalize';
import { nutritionixProvider } from './nutritionix';
import { offProvider } from './openFoodFacts';
import {
  detectPreparationState,
  isMeatLike,
  preparationMatches,
} from './preparation';
import { RankedFood, rankFoods } from './ranking';
import { getRestaurantFood, searchRestaurantFoods } from './restaurantFoods';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';
import { usdaProvider } from './usda';

export { barcodeVariants, normalizeBarcode };
export type { GroupedFoods };

/** Grouped search sections for the UI. */
export type GroupedSearchResults = GroupedFoods;

export interface SearchResult {
  foods: ProviderFood[];
  groups: GroupedSearchResults;
  /** Highest-confidence food when score >= AUTO_SELECT_CONFIDENCE. */
  autoSelected?: ProviderFood;
  failures: { provider: string; kind: ProviderError['kind'] }[];
  /** True when every network provider failed (bundled data may still return). */
  allFailed: boolean;
}

export interface BarcodeResult {
  custom?: string;
  food?: ProviderFood;
  candidates?: ProviderFood[];
  groups?: GroupedSearchResults;
  /** Best result is below the confidence bar — UI must ask the user to review. */
  lowConfidence: boolean;
  /** True when best score reaches auto-select threshold. */
  autoSelected?: boolean;
  offline: boolean;
}

function defaultProviders(): FoodProvider[] {
  return [usdaProvider, nutritionixProvider, fatsecretProvider, offProvider];
}

function enrich(nf: NormalizedFood, confidence: number): ProviderFood {
  return {
    provider: nf.provider,
    id: nf.id,
    name: nf.name,
    brand: nf.brand,
    restaurant: nf.restaurant,
    barcode: nf.barcode,
    imageUrl: nf.imageUrl,
    isGeneric: nf.isGeneric,
    nutritionPer100g: nf.per100g,
    nutritionPerServing: nf.perServing,
    gramsPerServing: nf.gramsPerServing,
    servingLabel: nf.servingLabel,
    servingBasis: nf.servingBasis,
    preparationState: nf.preparationState,
    ingredients: nf.ingredients,
    allergens: nf.allergens,
    verified: nf.verified,
    lastVerified: nf.lastVerified,
    dataType: nf.dataType,
    category: nf.category,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    warnings: nf.validation.warnings,
  };
}

function cachedToProvider(cached: CachedFood): ProviderFood {
  return {
    provider: cached.provider,
    id: cached.providerId,
    name: cached.name,
    brand: cached.brand,
    restaurant: cached.restaurant,
    barcode: cached.barcode,
    imageUrl: cached.imageUrl,
    isGeneric: cached.category === 'generic' || cached.provider === 'local',
    nutritionPer100g: cached.nutritionPer100g,
    nutritionPerServing: cached.nutritionPerServing,
    gramsPerServing: cached.gramsPerServing,
    servingLabel: cached.servingUnit,
    preparationState: cached.preparationState,
    ingredients: cached.ingredients,
    allergens: cached.allergens,
    verified: cached.verified,
    lastVerified: cached.lastVerified,
    category: cached.category,
    confidence: cached.confidence,
  };
}

/** Map a persisted custom food into the shared ProviderFood shape for ranking
 * and the My Foods search section. */
export function customFoodToProvider(food: CustomFood): ProviderFood {
  return {
    provider: 'custom',
    id: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    imageUrl: food.imageUrl,
    isGeneric: false,
    category: 'custom',
    nutritionPerServing: food.nutrition,
    gramsPerServing: food.gramsPerServing,
    servingLabel:
      food.servingQty === 1
        ? String(food.servingUnit)
        : `${food.servingQty} ${food.servingUnit}`,
    verified: false,
    lastVerified: food.updatedAt,
  };
}

function normalizeRaw(raw: ProviderFood): NormalizedFood {
  return normalizeFood(raw, {
    servingSize: raw.servingLabel,
    servingQuantity: raw.gramsPerServing,
    servingUnit: raw.servingUnit,
  });
}

/**
 * BarcodeLookupService + FoodSearchService — the ONE place all food lookup
 * lives. Pipeline: cache → bundled generics/restaurants → parallel providers →
 * normalize → validate → confidence → prep filter → dedupe → conflict →
 * rank → group.
 */
export function createFoodSearchService(
  foodRepo: FoodRepo,
  providers: FoodProvider[] = defaultProviders(),
) {
  async function cache(foods: ProviderFood[]): Promise<void> {
    const now = new Date().toISOString();
    for (const f of foods) {
      // Custom foods live in custom_foods — never duplicate into provider cache.
      if (f.provider === 'custom') continue;
      const record: CachedFood = {
        provider: f.provider,
        providerId: f.id,
        name: f.name,
        brand: f.brand,
        restaurant: f.restaurant,
        barcode: f.barcode,
        imageUrl: f.imageUrl,
        gramsPerServing: f.gramsPerServing,
        servingQty: 1,
        servingUnit: f.servingLabel,
        nutritionPer100g: f.nutritionPer100g,
        nutritionPerServing: f.nutritionPerServing,
        preparationState: f.preparationState,
        ingredients: f.ingredients,
        allergens: f.allergens,
        verified: f.verified,
        lastVerified: f.lastVerified,
        category: f.category,
        sourceLabel: undefined,
        flagged: false,
        confidence: f.confidence,
        servingBasis: f.servingBasis,
        cachedAt: now,
      };
      await foodRepo.upsertCachedFood(record).catch(() => {});
    }
  }

  function dedupeNormalized(foods: NormalizedFood[]): NormalizedFood[] {
    const seen = new Set<string>();
    const out: NormalizedFood[] = [];
    for (const f of foods) {
      const key =
        f.barcode?.replace(/^0+/, '') ||
        `${f.name.toLowerCase().trim()}|${(f.brand ?? f.restaurant ?? '').toLowerCase().trim()}|${f.preparationState}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  }

  function markCorroboration(foods: NormalizedFood[]): Set<NormalizedFood> {
    const corroborated = new Set<NormalizedFood>();
    for (let i = 0; i < foods.length; i++) {
      for (let j = i + 1; j < foods.length; j++) {
        if (foods[i].provider !== foods[j].provider && nutritionAgrees(foods[i], foods[j])) {
          corroborated.add(foods[i]);
          corroborated.add(foods[j]);
        }
      }
    }
    return corroborated;
  }

  /** Drop meat results whose preparation conflicts with the query. */
  function filterPrep(foods: NormalizedFood[], query: string): NormalizedFood[] {
    const queryPrep = detectPreparationState(query);
    if (queryPrep === 'unknown') return foods;
    const meatQuery = isMeatLike(query);
    return foods.filter((f) => {
      const foodPrep = f.preparationState ?? detectPreparationState(f.name);
      const meat = meatQuery || isMeatLike(f.name);
      return preparationMatches(queryPrep, foodPrep, { meatLike: meat });
    });
  }

  function pipeline(
    normalized: NormalizedFood[],
    ctx: { query?: string; scannedBarcode?: string },
  ): { foods: ProviderFood[]; groups: GroupedSearchResults; autoSelected?: ProviderFood; ranked: RankedFood[] } {
    const corroborated = markCorroboration(normalized);
    const enriched = normalized.map((nf) => {
      const confidence = scoreConfidence(nf, {
        query: ctx.query,
        scannedBarcode: ctx.scannedBarcode,
        corroborated: corroborated.has(nf),
      }).score;
      return enrich(nf, confidence);
    });

    // Conflict resolve among same-ish barcode / name peers (never average).
    const conflicted = resolveConflicts(
      enriched.map((food) => ({
        food,
        barcodeMatch: Boolean(
          ctx.scannedBarcode &&
            food.barcode &&
            barcodeVariants(food.barcode).some((v) => barcodeVariants(ctx.scannedBarcode!).includes(v)),
        ),
        verifiedAt: food.lastVerified,
      })),
    );
    const candidates = conflicted
      ? [conflicted.winner, ...conflicted.rejected]
      : enriched;

    const ranked = rankFoods(candidates, {
      query: ctx.query,
      scannedBarcode: ctx.scannedBarcode,
    });
    const groups = groupRankedFoods(ranked);
    const foods = ranked.map((r) => r.food);
    const top = ranked[0];
    const autoSelected =
      top && top.score >= AUTO_SELECT_CONFIDENCE && top.autoSelect ? top.food : undefined;
    return { foods, groups, autoSelected, ranked };
  }

  return {
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
      const q = query.trim();
      if (!q) {
        return {
          foods: [],
          groups: {
            bestMatch: null,
            usdaWholeFoods: [],
            packagedFoods: [],
            restaurantFoods: [],
            myFoods: [],
          },
          failures: [],
          allFailed: false,
        };
      }

      // 1) User-submitted My Foods — always search the local custom_foods table.
      const customRows = await foodRepo.listCustomFoods(q).catch(() => [] as CustomFood[]);
      const fromCustom = customRows.map((c) => normalizeRaw(customFoodToProvider(c)));

      // 2) Local cache (normalized DB) — prioritize previously seen provider foods.
      const cachedRows = await foodRepo.searchCached(q, 15).catch(() => [] as CachedFood[]);
      const fromCache = cachedRows
        .filter((c) => !c.flagged && c.provider !== 'custom')
        .map((c) => normalizeRaw(cachedToProvider(c)));

      // 3) Bundled generics + restaurant foods (instant, verified).
      const bundled: NormalizedFood[] = [];
      if (opts.filter !== 'branded') {
        bundled.push(...searchGenericFoods(q).map(normalizeRaw));
      }
      if (opts.filter !== 'generic') {
        bundled.push(...searchRestaurantFoods(q).map(normalizeRaw));
      }

      // 4) Parallel network providers.
      const results = await Promise.allSettled(providers.map((p) => p.search(q, opts)));
      const remote: NormalizedFood[] = [];
      const failures: SearchResult['failures'] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          remote.push(...r.value.map(normalizeRaw));
        } else {
          failures.push({
            provider: providers[i].id,
            kind: r.reason instanceof ProviderError ? r.reason.kind : 'network',
          });
        }
      });

      // 5) Normalize → prep filter → dedupe → conflict → rank → group.
      let all = dedupeNormalized([...fromCustom, ...fromCache, ...bundled, ...remote]);
      all = filterPrep(all, q);
      const { foods, groups, autoSelected } = pipeline(all, { query: q });

      cache(foods.slice(0, 40));
      return {
        foods,
        groups,
        autoSelected,
        failures,
        // True when every network provider failed (bundled/cache/custom may still return).
        allFailed: providers.length > 0 && failures.length === providers.length,
      };
    },

    async lookupBarcode(code: string, signal?: AbortSignal): Promise<BarcodeResult> {
      const variants = barcodeVariants(code);
      if (variants.length === 0) return { lowConfidence: false, offline: false };

      // 1) User's own foods win outright.
      for (const v of variants) {
        const custom = await foodRepo.findCustomByBarcode(v);
        if (custom) return { custom: custom.id, lowConfidence: false, offline: false, autoSelected: true };
      }

      // 2) Confident local cache.
      for (const v of variants) {
        const cached = await foodRepo.findCachedByBarcode(v);
        if (!cached || cached.provider === 'local' || cached.flagged) continue;
        const nf = normalizeRaw(cachedToProvider(cached));
        const conf = cached.confidence ?? scoreConfidence(nf, { scannedBarcode: code }).score;
        if (conf >= LOW_CONFIDENCE) {
          const food = enrich(nf, conf);
          return {
            food,
            lowConfidence: false,
            offline: false,
            autoSelected: conf >= AUTO_SELECT_CONFIDENCE,
            groups: groupRankedFoods([
              {
                food,
                score: conf,
                level: confidenceLevel(conf),
                reasons: [],
                autoSelect: conf >= AUTO_SELECT_CONFIDENCE,
              },
            ]),
          };
        }
      }

      // 3) Providers in preferred barcode order: nutritionix → fatsecret → usda → off
      //    (still parallel across variants for speed).
      const order = ['nutritionix', 'fatsecret', 'usda', 'off'] as const;
      const orderedProviders = [...providers].sort((a, b) => {
        const ia = order.indexOf(a.id as (typeof order)[number]);
        const ib = order.indexOf(b.id as (typeof order)[number]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      const attempts = orderedProviders.flatMap((p) => variants.map((v) => ({ p, v })));
      const settled = await Promise.allSettled(attempts.map((a) => a.p.getByBarcode(a.v, signal)));
      const hits: NormalizedFood[] = [];
      let sawNetworkFailure = false;
      settled.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          hits.push(normalizeRaw(r.value));
        } else if (
          r.status === 'rejected' &&
          r.reason instanceof ProviderError &&
          r.reason.kind === 'network'
        ) {
          sawNetworkFailure = true;
        }
      });

      const unique = dedupeNormalized(hits);
      if (unique.length === 0) return { lowConfidence: false, offline: sawNetworkFailure };

      const { ranked } = pipeline(unique, { scannedBarcode: code });

      // Exact barcode identity always outranks a higher-trust name collision.
      const variantSet = new Set(variants);
      const rankedByBarcode = [...ranked].sort((a, b) => {
        const aMatch = a.food.barcode
          ? barcodeVariants(a.food.barcode).some((v) => variantSet.has(v))
          : false;
        const bMatch = b.food.barcode
          ? barcodeVariants(b.food.barcode).some((v) => variantSet.has(v))
          : false;
        return Number(bMatch) - Number(aMatch) || b.score - a.score;
      });

      const bestNf =
        unique.find(
          (u) =>
            u.provider === rankedByBarcode[0].food.provider &&
            u.id === rankedByBarcode[0].food.id,
        ) ?? unique[0];
      const merged = mergeBestImage(bestNf, unique);
      const bestScore = rankedByBarcode[0]?.score ?? 0;
      const bestFood = enrich(merged.food, bestScore);
      if (merged.imageFrom && !rankedByBarcode[0].food.imageUrl) {
        bestFood.imageUrl = merged.food.imageUrl;
      }
      const candidates = rankedByBarcode.slice(1).map((r) => r.food);
      const orderedGroups = groupRankedFoods(rankedByBarcode);

      await cache([bestFood, ...candidates]);
      return {
        food: bestFood,
        candidates: candidates.length > 0 ? candidates : undefined,
        groups: orderedGroups,
        lowConfidence: bestScore < LOW_CONFIDENCE,
        autoSelected: bestScore >= AUTO_SELECT_CONFIDENCE,
        offline: false,
      };
    },

    /** Lightweight prefetch for partial queries (My Foods + cache + bundled). */
    async prefetchLikely(query: string): Promise<ProviderFood[]> {
      const q = query.trim();
      if (q.length < 2) return [];
      const custom = await foodRepo.listCustomFoods(q).catch(() => [] as CustomFood[]);
      const cached = await foodRepo.searchCached(q, 8).catch(() => [] as CachedFood[]);
      const bundled = [
        ...searchGenericFoods(q, 5),
        ...searchRestaurantFoods(q, 5),
      ];
      const foods = [
        ...custom.map(customFoodToProvider),
        ...cached.filter((c) => !c.flagged && c.provider !== 'custom').map(cachedToProvider),
        ...bundled,
      ];
      const ranked = rankFoods(foods, { query: q });
      return ranked.slice(0, 12).map((r) => r.food);
    },

    getGenericFood,
    getRestaurantFood,
  };
}

export type FoodSearchService = ReturnType<typeof createFoodSearchService>;
