import { GYM_SEARCH_RADIUS_M } from '../../../../convex/lib/geo';
import {
  TEXT_SEARCH_FIELD_MASK,
  buildTextSearchBody,
  geocodeAddress,
  parseTextSearchResponse,
  searchGymsNearby,
} from '../../../../convex/lib/googlePlaces';

const VENICE = { lat: 33.9946, lng: -118.4747 };

function respond(payload: unknown, status = 200) {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  })) as unknown as typeof fetch;
}

describe('Google Places text search', () => {
  it('asks for gyms only, ranked by distance, inside the seven-mile box', () => {
    const body = buildTextSearchBody({ query: 'Planet Fitness', anchor: VENICE, radiusM: GYM_SEARCH_RADIUS_M });
    expect(body).toMatchObject({
      textQuery: 'Planet Fitness',
      includedType: 'gym',
      rankPreference: 'DISTANCE',
      pageSize: 20,
    });
    const box = (body.locationRestriction as { rectangle: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }).rectangle;
    expect(box.low.latitude).toBeLessThan(VENICE.lat);
    expect(box.high.latitude).toBeGreaterThan(VENICE.lat);
    expect(box.low.longitude).toBeLessThan(VENICE.lng);
    expect(box.high.longitude).toBeGreaterThan(VENICE.lng);
  });

  it('tolerates the empty response and skips malformed places', () => {
    expect(parseTextSearchResponse({})).toEqual([]);
    expect(parseTextSearchResponse(null)).toEqual([]);
    expect(
      parseTextSearchResponse({
        places: [
          { id: 'ok', displayName: { text: 'Gym' }, location: { latitude: 1, longitude: 2 } },
          { id: 'no-location', displayName: { text: 'Nowhere' } },
          { displayName: { text: 'No id' }, location: { latitude: 1, longitude: 2 } },
        ],
      }),
    ).toEqual([{ placeId: 'ok', name: 'Gym', address: '', lat: 1, lng: 2, businessStatus: undefined }]);
  });

  it('sends the key and field mask, drops closed and far gyms, and sorts by distance', async () => {
    const fetchImpl = respond({
      places: [
        {
          id: 'far',
          displayName: { text: 'Far Gym' },
          formattedAddress: 'Pasadena',
          location: { latitude: 34.1478, longitude: -118.1445 },
        },
        {
          id: 'mid',
          displayName: { text: 'Mid Gym' },
          formattedAddress: 'Santa Monica',
          location: { latitude: 34.0094, longitude: -118.4973 },
        },
        {
          id: 'closed',
          displayName: { text: 'Closed Gym' },
          formattedAddress: 'Venice',
          location: { latitude: 33.995, longitude: -118.475 },
          businessStatus: 'CLOSED_PERMANENTLY',
        },
        {
          id: 'near',
          displayName: { text: 'Near Gym' },
          formattedAddress: 'Venice',
          location: { latitude: 33.9962, longitude: -118.4732 },
        },
      ],
    });
    const found = await searchGymsNearby({
      apiKey: 'k-e-y',
      query: 'gym',
      anchor: VENICE,
      radiusM: GYM_SEARCH_RADIUS_M,
      fetchImpl,
    });
    expect(found.map((gym) => gym.placeId)).toEqual(['near', 'mid']);
    expect(found[0].distanceM).toBeLessThan(found[1].distanceM);

    const [, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('k-e-y');
    expect(headers['X-Goog-FieldMask']).toBe(TEXT_SEARCH_FIELD_MASK);
    expect(init.method).toBe('POST');
  });

  it('turns an auth failure into a message with no key in it', async () => {
    const fetchImpl = respond({ error: { message: 'API key not valid: k-e-y' } }, 403);
    await expect(
      searchGymsNearby({ apiKey: 'k-e-y', query: 'gym', anchor: VENICE, radiusM: 1000, fetchImpl }),
    ).rejects.toThrow(/not configured correctly/);
    await expect(
      searchGymsNearby({ apiKey: '   ', query: 'gym', anchor: VENICE, radiusM: 1000, fetchImpl }),
    ).rejects.toThrow(/not configured/);
  });
});

describe('geocoding', () => {
  it('takes the first result and keeps the key out of the message', async () => {
    const fetchImpl = respond({
      status: 'OK',
      results: [
        { formatted_address: 'Venice, CA, USA', geometry: { location: { lat: 33.985, lng: -118.47 } } },
        { formatted_address: 'Venice, Italy', geometry: { location: { lat: 45.44, lng: 12.32 } } },
      ],
    });
    expect(await geocodeAddress({ apiKey: 'k-e-y', address: 'venice', fetchImpl })).toEqual({
      lat: 33.985,
      lng: -118.47,
      label: 'Venice, CA, USA',
    });
    const [url] = (fetchImpl as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain('address=venice');

    const denied = respond({ status: 'REQUEST_DENIED', error_message: 'key k-e-y is bad' });
    await expect(geocodeAddress({ apiKey: 'k-e-y', address: 'x', fetchImpl: denied })).rejects.toThrow(
      /not configured correctly/,
    );
    const none = respond({ status: 'ZERO_RESULTS', results: [] });
    await expect(geocodeAddress({ apiKey: 'k-e-y', address: 'x', fetchImpl: none })).rejects.toThrow(
      /could not find that address/i,
    );
  });
});
