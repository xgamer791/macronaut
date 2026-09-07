import { boundingBox, haversineM, type GeoPoint } from './geo';

/** Google Places (New) Text Search and the Geocoding API, called with a
 * server key. Callers must never send the key to a client, and no error
 * message built here ever contains it. `fetchImpl` is injectable so the
 * request shape is unit-tested without the network. */

export type FetchLike = typeof fetch;

export interface PlaceGym {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  businessStatus?: string;
}

export interface FoundGym extends PlaceGym {
  distanceM: number;
}

export const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
export const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
/** Only what the app shows. Every extra field is a pricier SKU. */
export const TEXT_SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus';

const DEFAULT_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 20;

export function buildTextSearchBody(opts: {
  query: string;
  anchor: GeoPoint;
  radiusM: number;
}): Record<string, unknown> {
  const box = boundingBox(opts.anchor, opts.radiusM);
  return {
    textQuery: opts.query,
    includedType: 'gym',
    rankPreference: 'DISTANCE',
    pageSize: PAGE_SIZE,
    locationRestriction: {
      rectangle: {
        low: { latitude: box.low.lat, longitude: box.low.lng },
        high: { latitude: box.high.lat, longitude: box.high.lng },
      },
    },
  };
}

/** Tolerates the empty response, which omits `places` entirely. */
export function parseTextSearchResponse(data: unknown): PlaceGym[] {
  const places = (data as { places?: unknown[] } | null)?.places;
  if (!Array.isArray(places)) return [];
  const out: PlaceGym[] = [];
  for (const raw of places) {
    const place = raw as {
      id?: unknown;
      displayName?: { text?: unknown };
      formattedAddress?: unknown;
      location?: { latitude?: unknown; longitude?: unknown };
      businessStatus?: unknown;
    };
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (
      typeof place.id !== 'string' ||
      typeof place.displayName?.text !== 'string' ||
      typeof lat !== 'number' ||
      typeof lng !== 'number'
    ) {
      continue;
    }
    out.push({
      placeId: place.id,
      name: place.displayName.text,
      address: typeof place.formattedAddress === 'string' ? place.formattedAddress : '',
      lat,
      lng,
      businessStatus:
        typeof place.businessStatus === 'string' ? place.businessStatus : undefined,
    });
  }
  return out;
}

/** Every gym matching `query` inside the circle, closest first. The rectangle
 * Google restricts to is the circle's bounding box, so the corners are
 * trimmed here by real distance. */
export async function searchGymsNearby(opts: {
  apiKey: string;
  query: string;
  anchor: GeoPoint;
  radiusM: number;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<FoundGym[]> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Gym search is not configured');
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await doFetch(TEXT_SEARCH_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(
        buildTextSearchBody({ query: opts.query, anchor: opts.anchor, radiusM: opts.radiusM }),
      ),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(parseApiError(res.status, text));
    }
    const data = (await res.json()) as unknown;
    return parseTextSearchResponse(data)
      .filter((place) => place.businessStatus !== 'CLOSED_PERMANENTLY')
      .map((place) => ({ ...place, distanceM: haversineM(opts.anchor, place) }))
      .filter((place) => place.distanceM <= opts.radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
  } finally {
    clearTimeout(timer);
  }
}

/** A rough address → one point, for people who would rather type than share
 * their location. */
export async function geocodeAddress(opts: {
  apiKey: string;
  address: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<{ lat: number; lng: number; label: string }> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Gym search is not configured');
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(opts.address)}&key=${encodeURIComponent(key)}`;
    const res = await doFetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(parseApiError(res.status, text));
    }
    const data = (await res.json()) as {
      status?: string;
      error_message?: string;
      results?: { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    const first = data.results?.[0];
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;
    if (data.status === 'ZERO_RESULTS' || typeof lat !== 'number' || typeof lng !== 'number') {
      if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(statusMessage(data.status));
      }
      throw new Error('Could not find that address');
    }
    return { lat, lng, label: first?.formatted_address || opts.address };
  } finally {
    clearTimeout(timer);
  }
}

function statusMessage(status: string): string {
  if (status === 'REQUEST_DENIED') return 'Gym search is not configured correctly';
  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') {
    return 'Gym search is busy — try again in a moment';
  }
  return 'Gym search failed';
}

/** Never echoes the response body: Google's error text can quote the request,
 * and the request carried the key. */
function parseApiError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'Gym search is not configured correctly';
  if (status === 429) return 'Gym search is busy — try again in a moment';
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') detail = parsed.error.message;
  } catch {
    detail = '';
  }
  return detail ? `Gym search failed (${status}): ${detail.slice(0, 120)}` : `Gym search failed (${status})`;
}
