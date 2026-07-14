import { MACRO_KEYS, MacroKey, Nutrition } from '@/domain/types';
import { barcodeVariants, normalizeBarcode } from './barcodeNormalize';
import { foodHttp, HttpClientError } from './httpClient';
import { detectPreparationState } from './preparation';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

/** USDA nutrient ids → our fields. Values are per 100 g for all data types
 * in the search response. */
const NUTRIENT_MAP: Record<number, MacroKey | 'calories'> = {
  1008: 'calories',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
  2000: 'sugar',
  1258: 'saturatedFat',
  1093: 'sodium',
  1253: 'cholesterol',
};

/** Prefer Foundation → SR Legacy → Survey (FNDDS) → Branded. */
const DATA_TYPE_PRIORITY: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
};

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: { nutrientId: number; value: number; unitName?: string }[];
}

function apiKey(): string {
  return process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';
}

function nutritionPer100g(food: UsdaSearchFood): Nutrition | undefined {
  if (!food.foodNutrients?.length) return undefined;
  const n: Nutrition = { calories: 0 };
  let sawCalorie = false;
  let sawMacro = false;
  for (const fn of food.foodNutrients) {
    const key = NUTRIENT_MAP[fn.nutrientId];
    if (!key || typeof fn.value !== 'number') continue;
    if (key === 'calories') {
      n.calories = fn.value;
      sawCalorie = true;
    } else {
      n[key] = fn.value;
      if (key === 'protein' || key === 'carbs' || key === 'fat') sawMacro = true;
    }
  }
  // Search hits occasionally include Foundation rows with empty energy — drop them.
  if (!sawCalorie && !sawMacro) return undefined;
  if (n.calories <= 0 && !sawMacro) return undefined;
  return n;
}

function toProviderFood(food: UsdaSearchFood): ProviderFood {
  const per100 = nutritionPer100g(food);
  const isGeneric = food.dataType !== 'Branded';
  let gramsPerServing: number | undefined;
  if (
    food.servingSize &&
    food.servingSizeUnit &&
    ['g', 'grm', 'ml', 'mlt'].includes(food.servingSizeUnit.toLowerCase())
  ) {
    gramsPerServing = food.servingSize;
  }
  let nutritionPerServing: Nutrition | undefined;
  if (per100 && gramsPerServing) {
    const f = gramsPerServing / 100;
    nutritionPerServing = { calories: per100.calories * f };
    for (const k of MACRO_KEYS) {
      const v = per100[k];
      if (v !== undefined) nutritionPerServing[k] = v * f;
    }
  }
  return {
    provider: 'usda',
    id: String(food.fdcId),
    name: food.description,
    brand: food.brandName || food.brandOwner || undefined,
    barcode: food.gtinUpc || undefined,
    isGeneric,
    nutritionPer100g: per100,
    nutritionPerServing: nutritionPerServing ?? (isGeneric ? undefined : per100),
    gramsPerServing: gramsPerServing ?? (isGeneric ? 100 : undefined),
    servingLabel:
      food.householdServingFullText ||
      (gramsPerServing ? `${gramsPerServing} ${food.servingSizeUnit}` : isGeneric ? '100 g' : undefined),
    preparationState: detectPreparationState(food.description),
    dataType: food.dataType,
    category: isGeneric ? 'generic' : 'packaged',
  };
}

function sortByDataType(foods: ProviderFood[]): ProviderFood[] {
  return [...foods].sort((a, b) => {
    const pa = DATA_TYPE_PRIORITY[a.dataType ?? ''] ?? 9;
    const pb = DATA_TYPE_PRIORITY[b.dataType ?? ''] ?? 9;
    if (pa !== pb) return pa - pb;
    // Within a data type, prefer panels that actually list energy.
    const ca = a.nutritionPer100g?.calories ?? a.nutritionPerServing?.calories ?? 0;
    const cb = b.nutritionPer100g?.calories ?? b.nutritionPerServing?.calories ?? 0;
    return Number(cb > 0) - Number(ca > 0);
  });
}

function barcodeMatches(gtinUpc: string | undefined, scanned: string): boolean {
  if (!gtinUpc) return false;
  const scannedSet = new Set(barcodeVariants(scanned));
  return barcodeVariants(gtinUpc).some((v) => scannedSet.has(v));
}

async function requestJson<T>(
  url: string,
  init: { signal?: AbortSignal; method?: string; body?: string } = {},
): Promise<T> {
  try {
    const res = await foodHttp.request(url, {
      signal: init.signal,
      method: init.method,
      body: init.body,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    if (res.status === 403) throw new ProviderError('USDA API key rejected', 'usda', 'auth');
    // DEMO_KEY / edge nginx sometimes answers burst GETs with a bare 400 — treat as rate limit.
    if (res.status === 400 || res.status === 429) {
      throw new ProviderError('USDA rate limit reached', 'usda', 'rate-limit');
    }
    if (!res.ok) throw new ProviderError(`USDA error ${res.status}`, 'usda', 'bad-response');
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      if (err.kind === 'rate-limit') throw new ProviderError('USDA rate limit reached', 'usda', 'rate-limit');
      // foodHttp surfaces non-ok as http/server after retries; map DEMO_KEY 400s.
      if (err.status === 400 || err.status === 429) {
        throw new ProviderError('USDA rate limit reached', 'usda', 'rate-limit');
      }
      if (err.kind === 'server' || err.kind === 'http') {
        throw new ProviderError(`USDA error ${err.status ?? ''}`.trim(), 'usda', 'bad-response');
      }
      throw new ProviderError('Network request failed', 'usda', 'network');
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError('Network request failed', 'usda', 'network');
  }
}

/** POST /foods/search — avoids GET query-string quirks and is the USDA-recommended path.
 * Retries DEMO_KEY / nginx bare-400 bursts with backoff. */
async function searchFoods(
  query: string,
  dataType: string[],
  pageSize: number,
  signal?: AbortSignal,
): Promise<UsdaSearchFood[]> {
  const url = `${BASE}/foods/search?api_key=${apiKey()}`;
  const body = JSON.stringify({ query, dataType, pageSize });
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const json = await requestJson<{ foods?: UsdaSearchFood[] }>(url, {
        signal,
        method: 'POST',
        body,
      });
      return json.foods ?? [];
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof ProviderError && (err.kind === 'rate-limit' || err.kind === 'network');
      if (!retryable || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

export const usdaProvider: FoodProvider = {
  id: 'usda',

  async search(query, opts: SearchOptions = {}) {
    const filter = opts.filter ?? 'all';
    const pageSize = opts.limit ?? 25;
    // Query Foundation/SR/Survey separately from Branded so relevance-ranked
    // branded floods can't crowd reference foods off the first page.
    let foods: ProviderFood[] = [];
    if (filter === 'branded') {
      foods = (await searchFoods(query, ['Branded'], pageSize, opts.signal))
        .filter((f) => f.description)
        .map(toProviderFood);
    } else if (filter === 'generic') {
      foods = (
        await searchFoods(query, ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], pageSize, opts.signal)
      )
        .filter((f) => f.description)
        .map(toProviderFood);
    } else {
      const genericPage = Math.max(10, Math.ceil(pageSize * 0.6));
      const brandedPage = Math.max(10, pageSize);
      const [genericHits, brandedHits] = await Promise.all([
        searchFoods(query, ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], genericPage, opts.signal),
        searchFoods(query, ['Branded'], brandedPage, opts.signal),
      ]);
      const seen = new Set<number>();
      const merged: UsdaSearchFood[] = [];
      for (const f of [...genericHits, ...brandedHits]) {
        if (seen.has(f.fdcId)) continue;
        seen.add(f.fdcId);
        merged.push(f);
      }
      foods = merged.filter((f) => f.description).map(toProviderFood);
    }
    foods = foods.filter((f) => {
      const n = f.nutritionPer100g ?? f.nutritionPerServing;
      if (!n) return false;
      if (n.calories > 0) return true;
      return (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0) > 0;
    });
    return sortByDataType(foods).slice(0, pageSize);
  },

  async getByBarcode(code, signal) {
    const { canonical, digits } = normalizeBarcode(code);
    const queryCode = canonical ?? digits;
    const foods = await searchFoods(queryCode, ['Branded'], 10, signal);
    const match = foods.find((f) => barcodeMatches(f.gtinUpc, code));
    return match ? toProviderFood(match) : null;
  },
};
