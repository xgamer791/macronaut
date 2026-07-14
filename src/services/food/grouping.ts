import { detectPreparationState } from './preparation';
import { barcodeVariants } from './barcodeNormalize';
import { RankedFood } from './ranking';
import { FoodCategory, ProviderFood } from './types';

/** Group ranked foods into UI sections, deduplicating by identity. */

export interface GroupedFoods {
  bestMatch: ProviderFood | null;
  usdaWholeFoods: ProviderFood[];
  packagedFoods: ProviderFood[];
  restaurantFoods: ProviderFood[];
  myFoods: ProviderFood[];
}

function inferCategory(food: ProviderFood): FoodCategory {
  if (food.category) return food.category;
  if (food.provider === 'custom') return 'custom';
  if (food.provider === 'restaurant' || food.restaurant) return 'restaurant';
  if (food.provider === 'local' || (food.isGeneric && food.provider === 'usda')) return 'generic';
  if (food.provider === 'usda' && food.isGeneric) return 'generic';
  if (food.brand || food.barcode || food.provider === 'off' || food.provider === 'nutritionix' || food.provider === 'fatsecret') {
    return 'packaged';
  }
  if (food.isGeneric) return 'generic';
  return 'packaged';
}

/** Stable identity for dedupe: barcode variants, else name+brand+prep. */
export function foodIdentityKey(food: ProviderFood): string {
  if (food.barcode) {
    const variants = barcodeVariants(food.barcode);
    const canonical = variants.find((v) => v.length === 13) ?? variants.sort()[0] ?? food.barcode;
    return `bc:${canonical.replace(/^0+/, '') || canonical}`;
  }
  const prep = food.preparationState ?? detectPreparationState(food.name);
  const brand = (food.brand ?? food.restaurant ?? '').toLowerCase().trim();
  return `n:${food.name.toLowerCase().trim()}|${brand}|${prep}`;
}

/** Keep the best-ranked food per identity key (preserves input order preference). */
export function dedupeByIdentity(ranked: RankedFood[]): RankedFood[] {
  const seen = new Set<string>();
  const out: RankedFood[] = [];
  for (const r of ranked) {
    const key = foodIdentityKey(r.food);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Group a ranked list into sections. `myFoods` are custom-category entries
 * (or provider === 'local' favorites passed in via category: 'custom').
 * Deduplicates so we never show twenty near-identical chicken entries.
 */
export function groupRankedFoods(ranked: RankedFood[]): GroupedFoods {
  const unique = dedupeByIdentity(ranked);
  const bestMatch = unique[0]?.food ?? null;

  const usdaWholeFoods: ProviderFood[] = [];
  const packagedFoods: ProviderFood[] = [];
  const restaurantFoods: ProviderFood[] = [];
  const myFoods: ProviderFood[] = [];

  for (const r of unique) {
    const f = r.food;
    // Skip duplicating the best match into every bucket? Spec says group into
    // buckets; bestMatch is highlighted separately but may also appear in its bucket.
    const cat = inferCategory(f);
    if (cat === 'custom') {
      myFoods.push(f);
      continue;
    }
    if (cat === 'restaurant') {
      restaurantFoods.push(f);
      continue;
    }
    if (cat === 'generic' || f.provider === 'usda' || f.provider === 'local') {
      if (f.isGeneric || f.provider === 'local' || (f.provider === 'usda' && !f.brand)) {
        usdaWholeFoods.push(f);
        continue;
      }
    }
    packagedFoods.push(f);
  }

  return { bestMatch, usdaWholeFoods, packagedFoods, restaurantFoods, myFoods };
}
