import { askNutritionAssistant, runAssistantAgent } from '../grokChat';

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
      }),
    );
  });
});

describe('runAssistantAgent', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockRepos() {
    return {
      settings: {
        get: jest.fn(async (_k: string, fallback: unknown) => fallback),
        set: jest.fn(async () => undefined),
      },
      diary: {
        entriesForDate: jest.fn(async () => []),
        add: jest.fn(),
      },
      activity: {
        totalBurnedForDate: jest.fn(async () => 0),
        entriesForDate: jest.fn(async () => []),
      },
      dayNotes: {
        listForDate: jest.fn(async () => []),
        add: jest.fn(async (_d: string, body: string) => ({
          id: 'n1',
          date: '2026-07-17',
          body,
          createdAt: '',
          updatedAt: '',
        })),
        datesWithNotes: jest.fn(async () => []),
      },
      goals: {
        configFor: jest.fn(async () => null),
        getMarks: jest.fn(async () => ({})),
      },
      history: { recordLog: jest.fn(async () => undefined) },
    } as never;
  }

  it('uses tools then answers, and remembers prior answer for notes', async () => {
    let calls = 0;
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: { role: string; content?: string; tool_calls?: unknown[] }[];
      };
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'add_note',
                        arguments: JSON.stringify({ body: 'that' }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      // Second call should include tool result; return spoken confirmation.
      const hasTool = body.messages?.some((m) => m.role === 'tool');
      expect(hasTool).toBe(true);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Saved that to your notes.' } }],
        }),
      };
    }) as unknown as typeof fetch;

    const result = await runAssistantAgent({
      apiKey: 'xai-test',
      nutritionContext: 'remaining 100',
      question: 'Make a note of that',
      repos: mockRepos(),
      selectedDate: '2026-07-17',
      targetMeal: 'lunch',
      history: [
        { role: 'user', content: 'How many calories left?' },
        { role: 'assistant', content: 'You have about 400 calories left today.' },
      ],
    });

    expect(result.answer).toMatch(/Saved|notes/i);
    expect(result.memory.lastAnswer).toMatch(/Saved|notes/i);
    expect(calls).toBe(2);
  });
});
