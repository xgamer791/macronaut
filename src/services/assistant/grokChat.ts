export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PREAMBLE = `You are Macronaut Voice — a spoken nutrition coach inside a calorie tracker.
Reply ONLY with what you would say out loud: 1–2 short sentences, plain speech, round numbers.
No markdown, bullets, headers, or "Hear again" style notes.
Cover remaining calories/macros, food ideas that fit the budget, protein tips, and food comparisons when asked.
Use today's context when relevant; never invent logged meals.`;

function parseApiError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'Grok API key was rejected — check Settings';
  if (status === 429) return 'Grok rate limit hit — try again in a moment';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `Grok error (${status})`;
  } catch {
    return body.trim() || `Grok error (${status})`;
  }
}

/** Ask Grok a nutrition question with the user's daily diary context. */
export async function askNutritionAssistant(opts: {
  apiKey: string;
  nutritionContext: string;
  question: string;
  history?: AssistantMessage[];
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Add your Grok API key in Settings first');

  const question = opts.question.trim();
  if (!question) throw new Error('Say or type a question first');

  const model = opts.model ?? 'grok-4.5';
  const system = `${SYSTEM_PREAMBLE}\n\n--- Today's context ---\n${opts.nutritionContext}`;

  // Keep history tiny — long chats slow the round trip.
  const prior = (opts.history ?? []).slice(-2);

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: system },
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 120,
        // Default is "high" and feels very slow for voice turn-taking.
        reasoning_effort: 'low',
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(parseApiError(res.status, errText));
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty Grok response');
    return text;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
