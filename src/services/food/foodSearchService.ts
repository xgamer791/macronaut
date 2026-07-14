import { FoodRepo } from '@/repositories/foodRepo';
import { CachedFood } from '@/repositories/types';
import { barcodeVariants } from './barcodeVariants';
import { LOW_CONFIDENCE, scoreConfidence } from './confidence';
import { getGenericFood, searchGenericFoods } from './genericFoods';
import { mergeBestImage, nutritionAgrees } from './merge';
import { NormalizedFood, normalizeFood } from './normalize';
import { offProvider } from './openFoodFacts';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';
import { usdaProvider } from './usda';

export { barcodeVariants };

export interface SearchResult {
  foods: ProviderFood[];
  failures: { provider: string; kind: ProviderError['kind'] }[];
  /** True when every network provider failed (generics still returned). */
  allFailed: boolean;
}

export interface BarcodeResult {
  custom?: string;
  food?: ProviderFood;
  candidates?: ProviderFood[];
  /** Best result is below the confidence bar — UI must ask the user to review. */
  lowConfidence: boolean;
  offline: boolean;
}

/** Attach the normalized/validated/scored enrichment onto a ProviderFood so
 * the UI (which consumes ProviderFood) gets confidence, serving basis and
 * warnings without a separate model. */
function enrich(nf: NormalizedFood, confidence: number): ProviderFood {
  return {
    provider: nf.provider,
    id: nf.id,
    name: nf.name,
    brand: nf.brand,
    barcode: nf.barcode,
    imageUrl: nf.imageUrl,
    isGeneric: nf.isGeneric,
    nutritionPer100g: nf.per100g,
    nutritionPerServing: nf.perServing,
    gramsPerServing: nf.gramsPerServing,
    servingLabel: nf.servingLabel,
    servingBasis: nf.servingBasis,
    confidence,
    warnings: nf.validation.warnings,
  };
}

/**
 * BarcodeLookupService + FoodSearchService — the ONE place all food lookup
 * lives. Every result is normalized to a consistent model, sanity-checked,
 * confidence-scored, cross-referenced across sources, and ranked before it
 * reaches the UI. Providers are pluggable via the array; the pipeline is
 * source-agnostic.
 */
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
        confidence: f.confidence,
        servingBasis: f.servingBasis,
        cachedAt: now,
      };
      await foodRepo.upsertCachedFood(record).catch(() => {});
    }
  }

  function dedupe(foods: NormalizedFood[]): NormalizedFood[] {
    const seen = new Set<string>();
    const out: NormalizedFood[] = [];
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

  /** Mark foods whose per-100g nutrition is independently corroborated. */
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

  return {
    async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
      const locals = (opts.filter === 'branded' ? [] : searchGenericFoods(query)).map((f) =>
        normalizeFood(f),
      );

      const results = await Promise.allSettled(providers.map((p) => p.search(query, opts)));
      const remote: NormalizedFood[] = [];
      const failures: SearchResult['failures'] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          remote.push(
            ...r.value.map((raw) =>
              normalizeFood(raw, {
                servingSize: raw.servingLabel,
                servingQuantity: raw.gramsPerServing,
                servingUnit: raw.servingUnit,
              }),
            ),
          );
        } else {
          failures.push({
            provider: providers[i].id,
            kind: r.reason instanceof ProviderError ? r.reason.kind : 'network',
          });
        }
      });

      const all = dedupe([...locals, ...remote]);
      const corroborated = markCorroboration(all);
      const scored = all.map((nf) => ({
        nf,
        confidence: scoreConfidence(nf, { query, corroborated: corroborated.has(nf) }).score,
      }));

      const q = query.toLowerCase().trim();
      const rank = (s: { nf: NormalizedFood; confidence: number }): number => {
        const name = s.nf.name.toLowerCase();
        let r = 0;
        if (s.nf.provider === 'local') r += 300; // verified generics lead ingredient searches
        else if (s.nf.isGeneric) r += 120;
        if (name === q) r += 120;
        else if (name.startsWith(q)) r += 70;
        else if (name.includes(q)) r += 40;
        else {
          const words = q.split(/\s+/);
          r += words.filter((w) => name.includes(w)).length === words.length ? 25 : 0;
        }
        r += s.confidence * 60; // accuracy is a ranking signal
        return r;
      };
      scored.sort((a, b) => rank(b) - rank(a));

      const foods = scored.map((s) => enrich(s.nf, s.confidence));
      cache(foods);
      return { foods, failures, allFailed: failures.length === providers.length };
    },

    /** Barcode lookup across every provider + code variant, validated and
     * ranked by confidence. Best match first; the rest become candidates. */
    async lookupBarcode(code: string, signal?: AbortSignal): Promise<BarcodeResult> {
      const variants = barcodeVariants(code);
      if (variants.length === 0) return { lowConfidence: false, offline: false };

      // 1) User's own foods win outright.
      for (const v of variants) {
        const custom = await foodRepo.findCustomByBarcode(v);
        if (custom) return { custom: custom.id, lowConfidence: false, offline: false };
      }

      // 2) Trust the cache only when it scores confidently and isn't flagged.
      //    Legacy rows without a stored confidence get scored on the fly.
      for (const v of variants) {
        const cached = await foodRepo.findCachedByBarcode(v);
        if (!cached || cached.provider === 'local' || cached.flagged) continue;
        const nf = normalizeFood({
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
        });
        const conf = cached.confidence ?? scoreConfidence(nf, { scannedBarcode: code }).score;
        if (conf >= LOW_CONFIDENCE) {
          return { food: enrich(nf, conf), lowConfidence: false, offline: false };
        }
      }

      // 3) Query every provider across every variant, in parallel.
      const attempts = providers.flatMap((p) => variants.map((v) => ({ p, v })));
      const settled = await Promise.allSettled(attempts.map((a) => a.p.getByBarcode(a.v, signal)));
      const hits: NormalizedFood[] = [];
      let sawNetworkFailure = false;
      settled.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          hits.push(
            normalizeFood(r.value, {
              servingSize: r.value.servingLabel,
              servingQuantity: r.value.gramsPerServing,
              servingUnit: r.value.servingUnit,
            }),
          );
        } else if (r.status === 'rejected' && r.reason instanceof ProviderError && r.reason.kind === 'network') {
          sawNetworkFailure = true;
        }
      });

      const unique = dedupe(hits);
      if (unique.length === 0) return { lowConfidence: false, offline: sawNetworkFailure };

      const corroborated = markCorroboration(unique);
      const variantSet = new Set(variants);
      const scored = unique.map((nf) => ({
        nf,
        // The record actually carrying the scanned barcode is the strongest
        // identity signal — it must outrank a higher-trust source that only
        // matched by name.
        barcodeMatch: nf.barcode ? barcodeVariants(nf.barcode).some((v) => variantSet.has(v)) : false,
        confidence: scoreConfidence(nf, { scannedBarcode: code, corroborated: corroborated.has(nf) })
          .score,
      }));
      // Exact-barcode matches first, then by confidence (curated beats crowd).
      scored.sort(
        (a, b) => Number(b.barcodeMatch) - Number(a.barcodeMatch) || b.confidence - a.confidence,
      );

      // Give the winner the best available image from a same-identity match.
      const merged = mergeBestImage(
        scored[0].nf,
        scored.map((s) => s.nf),
      );
      const bestFood = enrich(merged.food, scored[0].confidence);
      const candidates = scored.slice(1).map((s) => enrich(s.nf, s.confidence));

      await cache([bestFood, ...candidates]);
      return {
        food: bestFood,
        candidates: candidates.length > 0 ? candidates : undefined,
        lowConfidence: scored[0].confidence < LOW_CONFIDENCE,
        offline: false,
      };
    },

    getGenericFood,
  };
}

export type FoodSearchService = ReturnType<typeof createFoodSearchService>;
