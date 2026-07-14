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
  for (const fn of food.foodNutrients) {
    const key = NUTRIENT_MAP[fn.nutrientId];
    if (!key || typeof fn.value !== 'number') continue;
    if (key === 'calories') n.calories = fn.value;
    else n[key] = fn.value;
  }
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
    return pa - pb;
  });
}

function barcodeMatches(gtinUpc: string | undefined, scanned: string): boolean {
  if (!gtinUpc) return false;
  const scannedSet = new Set(barcodeVariants(scanned));
  return barcodeVariants(gtinUpc).some((v) => scannedSet.has(v));
}

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const res = await foodHttp.request(url, { signal });
    if (res.status === 403) throw new ProviderError('USDA API key rejected', 'usda', 'auth');
    if (!res.ok) throw new ProviderError(`USDA error ${res.status}`, 'usda', 'bad-response');
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      if (err.kind === 'rate-limit') throw new ProviderError('USDA rate limit reached', 'usda', 'rate-limit');
      if (err.kind === 'server' || err.kind === 'http') {
        throw new ProviderError(`USDA error ${err.status ?? ''}`.trim(), 'usda', 'bad-response');
      }
      throw new ProviderError('Network request failed', 'usda', 'network');
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError('Network request failed', 'usda', 'network');
  }
}

export const usdaProvider: FoodProvider = {
  id: 'usda',

  async search(query, opts: SearchOptions = {}) {
    const filter = opts.filter ?? 'all';
    // Foundation → SR Legacy → Survey (FNDDS); Branded last / only when requested.
    const dataType =
      filter === 'branded'
        ? 'Branded'
        : filter === 'generic'
          ? 'Foundation,SR Legacy,Survey (FNDDS)'
          : 'Foundation,SR Legacy,Survey (FNDDS),Branded';
    const url = `${BASE}/foods/search?api_key=${apiKey()}&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent(dataType)}&pageSize=${opts.limit ?? 25}`;
    const json = await request<{ foods?: UsdaSearchFood[] }>(url, opts.signal);
    const foods = (json.foods ?? [])
      .filter((f) => f.description)
      .map(toProviderFood)
      .filter((f) => f.nutritionPer100g !== undefined || f.nutritionPerServing !== undefined);
    return sortByDataType(foods);
  },

  async getByBarcode(code, signal) {
    const { canonical, digits } = normalizeBarcode(code);
    const queryCode = canonical ?? digits;
    const url = `${BASE}/foods/search?api_key=${apiKey()}&query=${encodeURIComponent(queryCode)}&dataType=Branded&pageSize=10`;
    const json = await request<{ foods?: UsdaSearchFood[] }>(url, signal);
    const match = (json.foods ?? []).find((f) => barcodeMatches(f.gtinUpc, code));
    return match ? toProviderFood(match) : null;
  },
};
