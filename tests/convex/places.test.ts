import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { DAILY_SEARCH_CAP } from '../../convex/places';
import { TEXT_SEARCH_FIELD_MASK } from '../../convex/lib/googlePlaces';
import { backend, signIn } from './helpers';

const VENICE = { lat: 33.9946, lng: -118.4747 };

/** Three gyms: one two blocks away, one permanently closed, one in Pasadena
 * (well past seven miles). Only the first should come back. */
const textSearchPayload = {
  places: [
    {
      id: 'ChIJ-far',
      displayName: { text: "Gold's Gym Pasadena", languageCode: 'en' },
      formattedAddress: '1 Colorado Blvd, Pasadena, CA 91101, USA',
      location: { latitude: 34.1478, longitude: -118.1445 },
      businessStatus: 'OPERATIONAL',
    },
    {
      id: 'ChIJ-closed',
      displayName: { text: "Gold's Gym Marina", languageCode: 'en' },
      formattedAddress: '2 Admiralty Way, Marina del Rey, CA 90292, USA',
      location: { latitude: 33.98, longitude: -118.46 },
      businessStatus: 'CLOSED_PERMANENTLY',
    },
    {
      id: 'ChIJ-golds-venice',
      displayName: { text: "Gold's Gym Venice", languageCode: 'en' },
      formattedAddress: '360 Hampton Dr, Venice, CA 90291, USA',
      location: { latitude: 33.9962, longitude: -118.4732 },
      businessStatus: 'OPERATIONAL',
    },
  ],
};

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
}

/** Installs a fake as the global fetch the actions reach for. */
function installFetch(mock: ReturnType<typeof fakeFetch>) {
  globalThis.fetch = mock as unknown as typeof fetch;
}

describe('gym search', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });

  it('refuses every call without a session', async () => {
    const t = backend();
    await expect(t.query(api.places.available, {})).rejects.toThrow(/not signed in/i);
    await expect(t.action(api.places.geocode, { address: 'Venice, CA' })).rejects.toThrow(
      /not signed in/i,
    );
    await expect(t.action(api.places.searchGyms, { query: "Gold's", ...VENICE })).rejects.toThrow(
      /not signed in/i,
    );
  });

  it('reports itself unconfigured without a key and fails searches plainly', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const t = backend();
    const person = await signIn(t);
    expect(await person.repos.gyms.available()).toBe(false);
    await expect(person.repos.gyms.searchGyms({ query: "Gold's", ...VENICE })).rejects.toThrow(
      /not configured/i,
    );
    await expect(person.repos.gyms.geocode('Venice, CA')).rejects.toThrow(/not configured/i);
  });

  it('returns only open gyms within seven miles, written to the catalogue with member counts', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
    const fetchMock = fakeFetch(textSearchPayload);
    installFetch(fetchMock);
    const t = backend();
    const person = await signIn(t, 'person@example.com');
    const regular = await signIn(t, 'regular@example.com');

    // Somebody already calls the Venice gym home, so the result says so.
    const existing = await t.run(async (ctx) =>
      ctx.db.insert('gyms', {
        provider: 'google',
        placeId: 'ChIJ-golds-venice',
        name: "Gold's Gym Venice",
        address: '360 Hampton Dr, Venice, CA 90291, USA',
        lat: 33.9962,
        lng: -118.4732,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    await regular.repos.gyms.claim({ gymId: existing, joinGroup: true });

    expect(await person.repos.gyms.available()).toBe(true);
    const found = await person.repos.gyms.searchGyms({ query: "  Gold's  ", ...VENICE });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: existing,
      name: "Gold's Gym Venice",
      memberCount: 1,
    });
    expect(found[0].distanceM).toBeGreaterThan(0);
    expect(found[0].distanceM).toBeLessThan(500);
    expect(JSON.stringify(found)).not.toContain('test-places-key');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('places:searchText');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-places-key');
    expect(headers['X-Goog-FieldMask']).toBe(TEXT_SEARCH_FIELD_MASK);
    const body = JSON.parse(String(init.body)) as {
      textQuery: string;
      includedType: string;
      locationRestriction: { rectangle: { low: { latitude: number }; high: { latitude: number } } };
    };
    expect(body.textQuery).toBe("Gold's");
    expect(body.includedType).toBe('gym');
    expect(body.locationRestriction.rectangle.low.latitude).toBeLessThan(VENICE.lat);
    expect(body.locationRestriction.rectangle.high.latitude).toBeGreaterThan(VENICE.lat);

    // The catalogue holds the Venice row once; nothing outside the radius was written.
    const rows = await t.run(async (ctx) => ctx.db.query('gyms').collect());
    expect(rows.map((row) => row.placeId)).toEqual(['ChIJ-golds-venice']);

    await expect(person.repos.gyms.searchGyms({ query: '   ', ...VENICE })).rejects.toThrow(
      /gym's name/i,
    );
    await expect(
      person.repos.gyms.searchGyms({ query: "Gold's", lat: 200, lng: 0 }),
    ).rejects.toThrow(/location/i);
  });

  it('geocodes an address to one point', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
    installFetch(
      fakeFetch({
        status: 'OK',
        results: [
          {
            formatted_address: 'Venice, Los Angeles, CA, USA',
            geometry: { location: { lat: 33.985, lng: -118.4695 } },
          },
        ],
      }),
    );
    const t = backend();
    const person = await signIn(t);
    expect(await person.repos.gyms.geocode('venice ca')).toEqual({
      lat: 33.985,
      lng: -118.4695,
      label: 'Venice, Los Angeles, CA, USA',
    });

    installFetch(fakeFetch({ status: 'ZERO_RESULTS', results: [] }));
    await expect(person.repos.gyms.geocode('nowhere at all')).rejects.toThrow(
      /could not find that address/i,
    );
  });

  it('stops an account at the daily cap', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
    installFetch(fakeFetch({ places: [] }));
    const t = backend();
    const person = await signIn(t);
    await t.run(async (ctx) =>
      ctx.db.insert('placesUsage', {
        userId: person.userId,
        day: new Date().toISOString().slice(0, 10),
        count: DAILY_SEARCH_CAP,
      }),
    );
    await expect(person.repos.gyms.searchGyms({ query: "Gold's", ...VENICE })).rejects.toThrow(
      /too many gym searches/i,
    );
  });
});
