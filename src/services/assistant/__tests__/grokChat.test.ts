import { askNutritionAssistant } from '../grokChat';

describe('askNutritionAssistant', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires an API key', async () => {
    await expect(
      askNutritionAssistant({
        apiKey: '  ',
        nutritionContext: 'ctx',
        question: 'How many calories left?',
      }),
    ).rejects.toThrow(/Grok API key/);
  });

  it('posts chat completions and returns the reply', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'You have about 800 kcal left today.' } }],
      }),
    })) as unknown as typeof fetch;

    const answer = await askNutritionAssistant({
      apiKey: 'xai-test',
      nutritionContext: 'remaining 800',
      question: 'How many calories do I have left?',
    });

    expect(answer).toContain('800');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer xai-test',
        }),
      }),
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { reasoning_effort?: string; max_tokens?: number };
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_tokens).toBe(120);
  });

  it('retries without reasoning_effort on a 400', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: 'invalid reasoning' } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'About 500 calories left.' } }],
        }),
      };
    }) as unknown as typeof fetch;

    const answer = await askNutritionAssistant({
      apiKey: 'xai-test',
      nutritionContext: 'remaining 500',
      question: 'Calories left?',
    });
    expect(answer).toContain('500');
    expect(calls).toBe(2);
    const second = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body as string,
    ) as { reasoning_effort?: string };
    expect(second.reasoning_effort).toBeUndefined();
  });
});
