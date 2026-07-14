import { clearFatSecretTokenCache, fatsecretProvider, isConfigured } from '../fatsecret';

const realFetch = global.fetch;
const realId = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID;
const realSecret = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET;

afterEach(() => {
  global.fetch = realFetch;
  clearFatSecretTokenCache();
  process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID = realId;
  process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET = realSecret;
});

function mockFetchSequence(
  handlers: ((url: string, init?: RequestInit) => { status?: number; body: unknown })[],
) {
  let i = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const h = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    const { status = 200, body } = h(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => body,
    };
  }) as unknown as typeof fetch;
}

describe('fatsecretProvider', () => {
  it('is inactive without keys', async () => {
    delete process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET;
    expect(isConfigured()).toBe(false);
    expect(await fatsecretProvider.search('toast')).toEqual([]);
    expect(await fatsecretProvider.getByBarcode('3017620422003')).toBeNull();
  });

  it('obtains a token and searches foods', async () => {
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID = 'cid';
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET = 'csecret';
    mockFetchSequence([
      () => ({ body: { access_token: 'tok', expires_in: 3600 } }),
      (url, init) => {
        expect(url).toContain('server.api');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
        return {
          body: {
            foods: {
              food: {
                food_id: '33691',
                food_name: 'Toast',
                food_type: 'Generic',
                servings: {
                  serving: {
                    serving_description: '1 slice',
                    calories: '64',
                    protein: '2',
                    carbohydrate: '12',
                    fat: '0.9',
                    saturated_fat: '0.2',
                    sodium: '130',
                    metric_serving_amount: '25',
                    metric_serving_unit: 'g',
                    is_default: '1',
                  },
                },
              },
            },
          },
        };
      },
    ]);
    const foods = await fatsecretProvider.search('toast');
    expect(foods).toHaveLength(1);
    expect(foods[0].provider).toBe('fatsecret');
    expect(foods[0].nutritionPerServing?.calories).toBe(64);
    expect(foods[0].nutritionPerServing?.saturatedFat).toBe(0.2);
    expect(foods[0].gramsPerServing).toBe(25);
    expect(foods[0].isGeneric).toBe(true);
  });

  it('looks up barcode via GTIN-13 and hydrates food', async () => {
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID = 'cid';
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET = 'csecret';
    mockFetchSequence([
      () => ({ body: { access_token: 'tok', expires_in: 3600 } }),
      (_url, init) => {
        expect(String(init?.body)).toContain('food.find_id_for_barcode.v2');
        expect(String(init?.body)).toContain('0096619348656');
        return { body: { food_id: '99' } };
      },
      () => ({
        body: {
          food: {
            food_id: '99',
            food_name: 'Egg Whites',
            brand_name: 'Kirkland',
            food_type: 'Brand',
            servings: {
              serving: {
                calories: '25',
                protein: '5',
                carbohydrate: '0',
                fat: '0',
                serving_description: '46 g',
                metric_serving_amount: '46',
                metric_serving_unit: 'g',
              },
            },
          },
        },
      }),
    ]);
    const f = await fatsecretProvider.getByBarcode('096619348656');
    expect(f?.id).toBe('99');
    expect(f?.barcode).toBe('0096619348656');
    expect(f?.brand).toBe('Kirkland');
  });

  it('caches the access token across calls', async () => {
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID = 'cid';
    process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET = 'csecret';
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('oauth.fatsecret.com')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ access_token: 'cached-tok', expires_in: 3600 }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ foods: { food: [] } }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await fatsecretProvider.search('a');
    await fatsecretProvider.search('b');
    const tokenCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('oauth.fatsecret.com'));
    expect(tokenCalls).toHaveLength(1);
  });
});
