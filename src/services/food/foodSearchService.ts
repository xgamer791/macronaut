import { FoodRepo } from '@/repositories/foodRepo';
import { CachedFood } from '@/repositories/types';
import { getGenericFood, searchGenericFoods } from './genericFoods';
import { offProvider } from './openFoodFacts';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';
import { usdaProvider } from './usda';

export interface SearchResult {
  foods: ProviderFood[];
  /** Providers that failed (results may be partial). */
  failures: { provider: string; kind: ProviderError['kind'] }[];
  /** True when every network provider failed (bundled generics still work). */
  allFailed: boolean;
}

export interface BarcodeResult {
  custom?: string;
  food?: ProviderFood;
  /** Other plausible matches for user selection. */
  candidates?: ProviderFood[];
  offline: boolean;
}

/** Barcode formats vary (UPC-A vs EAN-13, dropped leading zeros). Try the
 * scanned code plus its common re-encodings. */
export function barcodeVariants(code: string): string[] {
  const raw = code.replace(/\D/g, '');
  const out = new Set<string>();
  if (!raw) return [];
  out.add(raw);
  const stripped = raw.replace(/^0+/, '');
  if (stripped) out.add(stripped);
  if (raw.length < 13) out.add(raw.padStart(13, '0'));
  if (raw.length < 12) out.add(raw.padStart(12, '0'));
  if (raw.length === 13 && raw.startsWith('0')) out.add(raw.slice(1));
  return [...out];
}

/** Relevance: bundled generics first for ingredient-style queries, then
 * reference (generic) database foods, then branded — within each tier by
 * name-match quality. */
function rankFoods(query: string, foods: ProviderFood[]): ProviderFood[] {
  const q = query.toLowerCase().trim();
  const score = (f: ProviderFood): number => {
    const name = f.name.toLowerCase();
    let s = 0;
    if (f.provider === 'local') s += 300;
    else if (f.isGeneric) s += 150;
    if (name === q) s += 100;
    else if (name.startsWith(q)) s += 60;
    else if (name.includes(q)) s += 40;
    else {
      const words = q.split(/\s+/);
      const hit = words.filter((w) => name.includes(w)).length;
      s += hit === words.length ? 25 : hit * 5;
    }
    if (f.imageUrl) s += 3;
    return s;
  };
  return foods
    .map((f, i) => ({ f, s: score(f), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

/** Layered search: bundled generics (always, instant, offline) + USDA
 * (generic + branded, rich data) + Open Food Facts (branded/international +
 * images). Results are deduped, ranked by intent, and cached locally so
 * previously seen foods stay available offline. Add a provider to the array
 * and every search and barcode lookup includes it. */
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
      // Bundled generics resolve instantly and never fail.
      const locals = opts.filter === 'branded' ? [] : searchGenericFoods(query);

      const results = await Promise.allSettled(providers.map((p) => p.search(query, opts)));
      const remote: ProviderFood[] = [];
      const failures: SearchResult['failures'] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') remote.push(...r.value);
        else {
          failures.push({
            provider: providers[i].id,
            kind: r.reason instanceof ProviderError ? r.reason.kind : 'network',
          });
        }
      });

      const deduped = dedupe([...locals, ...remote]);
      const ranked = rankFoods(query, deduped);
      cache(ranked); // fire-and-forget
      return { foods: ranked, failures, allFailed: failures.length === providers.length };
    },

    /** Resolution order: your custom foods → bundled generics (exact ids
     * never match barcodes, skipped) → local cache → ALL network providers
     * in parallel across common barcode re-encodings. First definitive hit
     * wins; other plausible hits are returned for user selection. */
    async lookupBarcode(code: string, signal?: AbortSignal): Promise<BarcodeResult> {
      const variants = barcodeVariants(code);
      if (variants.length === 0) return { offline: false };

      for (const v of variants) {
        const custom = await foodRepo.findCustomByBarcode(v);
        if (custom) return { custom: custom.id, offline: false };
      }

      for (const v of variants) {
        const cached = await foodRepo.findCachedByBarcode(v);
        if (cached && cached.provider !== 'local') {
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
      }

      // Fan out: every provider × every variant, in parallel.
      const attempts = providers.flatMap((p) => variants.map((v) => ({ p, v })));
      const settled = await Promise.allSettled(attempts.map((a) => a.p.getByBarcode(a.v, signal)));
      const hits: ProviderFood[] = [];
      let sawNetworkFailure = false;
      settled.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) hits.push(r.value);
        else if (
          r.status === 'rejected' &&
          r.reason instanceof ProviderError &&
          r.reason.kind === 'network'
        ) {
          sawNetworkFailure = true;
        }
      });

      const unique = dedupe(hits);
      if (unique.length > 0) {
        await cache(unique);
        // Best match first: prefer the barcode-native provider (OFF), then
        // richer records (image + serving data).
        const best = [...unique].sort((a, b) => {
          const w = (f: ProviderFood) =>
            (f.provider === 'off' ? 4 : 0) + (f.imageUrl ? 2 : 0) + (f.nutritionPerServing ? 1 : 0);
          return w(b) - w(a);
        });
        return {
          food: best[0],
          candidates: best.length > 1 ? best.slice(1) : undefined,
          offline: false,
        };
      }
      return { offline: sawNetworkFailure };
    },

    getGenericFood,
  };
}

export type FoodSearchService = ReturnType<typeof createFoodSearchService>;
