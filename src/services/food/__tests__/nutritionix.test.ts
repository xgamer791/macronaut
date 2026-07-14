import { nutritionixProvider, isConfigured } from '../nutritionix';

const realFetch = global.fetch;
const realId = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID;
const realKey = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY;

afterEach(() => {
  global.fetch = realFetch;
  process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID = realId;
  process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY = realKey;
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const payload = handler(url, init);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => payload,
    };
  }) as unknown as typeof fetch;
}

describe('nutritionixProvider', () => {
  it('is inactive without keys', async () => {
    delete process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID;
    delete process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY;
    expect(isConfigured()).toBe(false);
    expect(await nutritionixProvider.search('cola')).toEqual([]);
    expect(await nutritionixProvider.getByBarcode('0123456789012')).toBeNull();
  });

  it('maps barcode item with saturated fat and restaurant brand', async () => {
    process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID = 'app';
    process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY = 'key';
    mockFetch(() => ({
      foods: [
        {
          nix_item_id: 'abc',
          nix_item_name: 'Chicken Burrito',
          nix_brand_name: 'Chipotle',
          upc: '000111',
          nf_calories: 540,
          nf_protein: 45,
          nf_total_carbohydrate: 50,
          nf_total_fat: 20,
          nf_saturated_fat: 7,
          nf_sodium: 1200,
          nf_dietary_fiber: 8,
          nf_sugars: 4,
          serving_qty: 1,
          serving_unit: 'bowl',
          serving_weight_grams: 450,
          nf_ingredient_statement: 'Chicken, Rice, Beans',
          photo: { thumb: 'https://img/x.jpg' },
        },
      ],
    }));
    const f = await nutritionixProvider.getByBarcode('000111');
    expect(f?.provider).toBe('nutritionix');
    expect(f?.restaurant).toBe('Chipotle');
    expect(f?.category).toBe('restaurant');
    expect(f?.nutritionPerServing?.saturatedFat).toBe(7);
    expect(f?.nutritionPerServing?.sodium).toBe(1200);
    expect(f?.imageUrl).toBe('https://img/x.jpg');
    expect(f?.ingredients).toEqual(expect.arrayContaining(['Chicken']));
  });

  it('searches instant + resolves branded items', async () => {
    process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID = 'app';
    process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY = 'key';
    mockFetch((url) => {
      if (url.includes('/v2/search/instant')) {
        return {
          branded: [{ food_name: 'Bar', brand_name: 'Acme', nix_item_id: 'nix1' }],
          common: [],
        };
      }
      return {
        foods: [
          {
            nix_item_id: 'nix1',
            nix_item_name: 'Protein Bar',
            nix_brand_name: 'Acme',
            nf_calories: 200,
            nf_protein: 20,
            nf_total_carbohydrate: 22,
            nf_total_fat: 7,
            serving_weight_grams: 50,
            serving_qty: 1,
            serving_unit: 'bar',
          },
        ],
      };
    });
    const foods = await nutritionixProvider.search('protein bar');
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe('Protein Bar');
    expect(foods[0].category).toBe('packaged');
  });
});
