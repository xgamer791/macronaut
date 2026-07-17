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
});