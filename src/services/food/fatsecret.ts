import { Nutrition } from '@/domain/types';
import { normalizeBarcode } from './barcodeNormalize';
import { foodHttp, HttpClientError } from './httpClient';
import { FoodProvider, ProviderError, ProviderFood, SearchOptions } from './types';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/** Reset cached token (tests). */
export function clearFatSecretTokenCache(): void {
  tokenCache = null;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID?.trim() &&
      process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET?.trim(),
  );
}

function basicAuth(): string {
  const id = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID!.trim();
  const secret = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET!.trim();
  // btoa is available in RN / modern Node; fall back for older environments.
  const raw = `${id}:${secret}`;
  if (typeof btoa === 'function') return btoa(raw);
  return Buffer.from(raw, 'utf8').toString('base64');
}

async function getAccessToken(signal?: AbortSignal): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'basic premier barcode',
    }).toString();
    const res = await foodHttp.request(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal,
      retry: false,
    });
    if (!res.ok) {
      throw new ProviderError('FatSecret auth failed', 'fatsecret', 'auth');
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new ProviderError('FatSecret auth failed', 'fatsecret', 'auth');
    }
    tokenCache = {
      accessToken: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      throw new ProviderError('FatSecret auth failed', 'fatsecret', 'auth');
    }
    throw new ProviderError('Network request failed', 'fatsecret', 'network');
  }
}

async function apiCall<T>(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const token = await getAccessToken(signal);
  const body = new URLSearchParams({ ...params, format: 'json' }).toString();
  try {
    return await foodHttp.requestJson<T>(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal,
    });
  } catch (err) {
    if (err instanceof HttpClientError) {
      if (err.kind === 'abort') throw err;
      if (err.kind === 'rate-limit') {
        throw new ProviderError('FatSecret rate limit', 'fatsecret', 'rate-limit');
      }
      if (err.status === 401 || err.status === 403) {
        tokenCache = null;
        throw new ProviderError('FatSecret auth failed', 'fatsecret', 'auth');
      }
      throw new ProviderError(
        `FatSecret error ${err.status ?? ''}`.trim(),
        'fatsecret',
        'bad-response',
      );
    }
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError('Network request failed', 'fatsecret', 'network');
  }
}

interface FsServing {
  serving_id?: string;
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  calories?: string;
  carbohydrate?: string;
  protein?: string;
  fat?: string;
  saturated_fat?: string;
  fiber?: string;
  sugar?: string;
  sodium?: string;
  cholesterol?: string;
  is_default?: string;
}

interface FsFood {
  food_id?: string;
  food_name?: string;
  brand_name?: string;
  food_type?: string;
  food_url?: string;
  servings?: { serving?: FsServing | FsServing[] };
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickServing(food: FsFood): FsServing | undefined {
  const raw = food.servings?.serving;
  if (!raw) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.find((s) => s.is_default === '1' || s.is_default === 'true') ?? list[0];
}

function nutritionFromServing(s: FsServing): Nutrition | undefined {
  const calories = num(s.calories);
  if (calories === undefined) return undefined;
  const n: Nutrition = { calories };
  const protein = num(s.protein);
  const carbs = num(s.carbohydrate);
  const fat = num(s.fat);
  const saturatedFat = num(s.saturated_fat);
  const fiber = num(s.fiber);
  const sugar = num(s.sugar);
  const sodium = num(s.sodium);
  const cholesterol = num(s.cholesterol);
  if (protein !== undefined) n.protein = protein;
  if (carbs !== undefined) n.carbs = carbs;
  if (fat !== undefined) n.fat = fat;
  if (saturatedFat !== undefined) n.saturatedFat = saturatedFat;
  if (fiber !== undefined) n.fiber = fiber;
  if (sugar !== undefined) n.sugar = sugar;
  if (sodium !== undefined) n.sodium = sodium;
  if (cholesterol !== undefined) n.cholesterol = cholesterol;
  return n;
}

function toProviderFood(food: FsFood): ProviderFood | null {
  if (!food.food_id || !food.food_name) return null;
  const serving = pickServing(food);
  const nutrition = serving ? nutritionFromServing(serving) : undefined;
  if (!nutrition) return null;
  const amount = num(serving?.metric_serving_amount);
  const unit = serving?.metric_serving_unit?.toLowerCase();
  const gramsPerServing =
    amount && unit && (unit === 'g' || unit === 'ml') ? amount : undefined;
  const isGeneric = (food.food_type ?? '').toLowerCase() === 'generic';
  return {
    provider: 'fatsecret',
    id: String(food.food_id),
    name: food.food_name,
    brand: food.brand_name || undefined,
    isGeneric,
    nutritionPerServing: nutrition,
    gramsPerServing,
    servingLabel: serving?.serving_description,
    servingUnit: unit,
    category: isGeneric ? 'generic' : 'packaged',
  };
}

async function getFoodById(foodId: string, signal?: AbortSignal): Promise<ProviderFood | null> {
  const json = await apiCall<{ food?: FsFood }>(
    { method: 'food.get.v2', food_id: foodId },
    signal,
  );
  return json.food ? toProviderFood(json.food) : null;
}

export const fatsecretProvider: FoodProvider & {
  isConfigured: typeof isConfigured;
  clearTokenCache: typeof clearFatSecretTokenCache;
} = {
  id: 'fatsecret',
  isConfigured,
  clearTokenCache: clearFatSecretTokenCache,

  async search(query, opts: SearchOptions = {}) {
    if (!isConfigured()) return [];
    const max = Math.min(opts.limit ?? 20, 50);
    const json = await apiCall<{
      foods?: { food?: FsFood | FsFood[]; total_results?: string };
    }>(
      {
        method: 'foods.search',
        search_expression: query,
        max_results: String(max),
        page_number: '0',
      },
      opts.signal,
    );

    const raw = json.foods?.food;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];

    // foods.search often returns summary rows without full servings — hydrate.
    const out: ProviderFood[] = [];
    for (const f of list.slice(0, max)) {
      if (!f.food_id) continue;
      const mapped = toProviderFood(f);
      if (mapped) {
        out.push(mapped);
        continue;
      }
      try {
        const full = await getFoodById(f.food_id, opts.signal);
        if (full) {
          if (opts.filter === 'generic' && !full.isGeneric) continue;
          if (opts.filter === 'branded' && full.isGeneric) continue;
          out.push(full);
        }
      } catch {
        // skip
      }
    }
    return out;
  },

  async getByBarcode(code, signal) {
    if (!isConfigured()) return null;
    const { canonical, digits } = normalizeBarcode(code);
    const gtin13 = canonical ?? (digits.length <= 13 ? digits.padStart(13, '0') : digits.slice(-13));
    if (!gtin13) return null;

    try {
      const json = await apiCall<{ food_id?: string | number }>(
        { method: 'food.find_id_for_barcode.v2', barcode: gtin13 },
        signal,
      );
      const foodId = json.food_id != null ? String(json.food_id) : '';
      if (!foodId || foodId === '0') return null;
      const food = await getFoodById(foodId, signal);
      if (food) food.barcode = gtin13;
      return food;
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'bad-response') return null;
      throw err;
    }
  },
};
