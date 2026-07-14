import { Nutrition } from '@/domain/types';
import { foodHttp, HttpClientError } from './httpClient';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';

const SEARCH_BASE = 'https://world.openfoodfacts.org';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
  ingredients_text?: string;
  allergens_tags?: string[];
}

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nutritionFrom(nutriments: OffProduct['nutriments'], suffix: '100g' | 'serving'): Nutrition | undefined {
  if (!nutriments) return undefined;
  const kcal = num(nutriments[`energy-kcal_${suffix}`]);
  if (kcal === undefined) return undefined;
  const n: Nutrition = { calories: kcal };
  const protein = num(nutriments[`proteins_${suffix}`]);
  const carbs = num(nutriments[`carbohydrates_${suffix}`]);
  const fat = num(nutriments[`fat_${suffix}`]);
  const fiber = num(nutriments[`fiber_${suffix}`]);
  const sugar = num(nutriments[`sugars_${suffix}`]);
  const saturatedFat = num(nutriments[`saturated-fat_${suffix}`]);
  // OFF reports sodium and cholesterol in grams → convert to mg.
  const sodium = num(nutriments[`sodium_${suffix}`]);
  const cholesterol = num(nutriments[`cholesterol_${suffix}`]);
  if (protein !== undefined) n.protein = protein;
  if (carbs !== undefined) n.carbs = carbs;
  if (fat !== undefined) n.fat = fat;
  if (fiber !== undefined) n.fiber = fiber;
  if (sugar !== undefined) n.sugar = sugar;
  if (saturatedFat !== undefined) n.saturatedFat = saturatedFat;
  if (sodium !== undefined) n.sodium = sodium * 1000;
  if (cholesterol !== undefined) n.cholesterol = cholesterol * 1000;
  return n;
}

function toProviderFood(p: OffProduct): ProviderFood | null {
  const name = p.product_name?.trim();
  if (!name || !p.code) return null;
  const per100 = nutritionFrom(p.nutriments, '100g');
  const perServing = nutritionFrom(p.nutriments, 'serving');
  if (!per100 && !perServing) return null;
  // Grams-per-serving is only meaningful when the serving unit is a mass.
  // For liquids OFF gives ml; the normalizer handles the ml case separately.
  const unit = p.serving_quantity_unit?.toLowerCase();
  const rawQty = num(p.serving_quantity);
  const gramsPerServing = unit === undefined || unit === 'g' ? rawQty : undefined;
  const ingredients = p.ingredients_text
    ? p.ingredients_text.split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  const allergens = p.allergens_tags?.map((t) => t.replace(/^en:/, '')).filter(Boolean);
  return {
    provider: 'off',
    id: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    imageUrl: p.image_front_small_url || p.image_front_url || undefined,
    isGeneric: false,
    nutritionPer100g: per100,
    nutritionPerServing: perServing,
    gramsPerServing,
    servingUnit: unit,
    servingLabel: p.serving_size || (rawQty ? `${rawQty} ${unit ?? 'g'}` : undefined),
    ingredients,
    allergens,
    category: 'packaged',
  };
}

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    return await foodHttp.requestJson<T>(url, { signal });
  } catch (err) {
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      if (err.kind === 'rate-limit') throw new ProviderError('Open Food Facts rate limit', 'off', 'rate-limit');
      if (err.kind === 'http' || err.kind === 'server') {
        throw new ProviderError(`Open Food Facts error ${err.status ?? ''}`.trim(), 'off', 'bad-response');
      }
      throw new ProviderError('Network request failed', 'off', 'network');
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError('Network request failed', 'off', 'network');
  }
}

export const offProvider: FoodProvider = {
  id: 'off',

  async search(query, opts: SearchOptions = {}) {
    // Branded products only — OFF has no generic/reference foods.
    if (opts.filter === 'generic') return [];
    const url = `${SEARCH_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${opts.limit ?? 25}&fields=code,product_name,brands,image_front_small_url,serving_size,serving_quantity,serving_quantity_unit,nutriments,ingredients_text,allergens_tags`;
    const json = await request<{ products?: OffProduct[] }>(url, opts.signal);
    return (json.products ?? [])
      .map(toProviderFood)
      .filter((f): f is ProviderFood => f !== null);
  },

  async getByBarcode(code, signal) {
    const url = `${SEARCH_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,image_front_small_url,serving_size,serving_quantity,serving_quantity_unit,nutriments,ingredients_text,allergens_tags`;
    try {
      const json = await request<{ status: number; product?: OffProduct }>(url, signal);
      if (json.status !== 1 || !json.product) return null;
      return toProviderFood(json.product);
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'bad-response') return null; // 404 = unknown barcode
      throw err;
    }
  },
};
