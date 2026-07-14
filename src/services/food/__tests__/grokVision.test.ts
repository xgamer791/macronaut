import { analyzeFoodPhoto } from '../grokVision';

describe('analyzeFoodPhoto', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses a Responses API food estimate', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            name: 'Grilled chicken breast',
            brand: null,
            servingQty: 180,
            servingUnit: 'g',
            gramsPerServing: 180,
            calories: 297,
            protein: 55,
            carbs: 0,
            fat: 6.5,
            fiber: 0,
            confidence: 0.82,
            notes: 'Skinless',
          }),
        }),
      }) as Response,
    );

    const result = await analyzeFoodPhoto({
      apiKey: 'xai-test',
      dataUrl: 'data:image/jpeg;base64,abc',
    });

    expect(result.name).toBe('Grilled chicken breast');
    expect(result.nutrition.calories).toBe(297);
    expect(result.servingUnit).toBe('g');
    expect(result.confidence).toBeCloseTo(0.82);
  });

  it('rejects a missing API key', async () => {
    await expect(
      analyzeFoodPhoto({ apiKey: '  ', dataUrl: 'data:image/jpeg;base64,abc' }),
    ).rejects.toThrow(/Grok API key/);
  });
});
