export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PREAMBLE = `You are Macronaut Voice — a concise, friendly nutrition assistant inside a calorie tracking app.
Answer questions about the user's remaining calories and macros, suggest foods that fit their remaining budget, compare foods (e.g. chicken thigh vs drumstick), and give practical protein/carb/fat advice.
Use the live daily context below when relevant. If data is missing, say so briefly.
Keep answers short and speakable (2–5 sentences unless they ask for detail). Use plain language and round numbers. Do not invent the user's log — only use the provided context for their day. General nutrition facts are fine when comparing foods.`;

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

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: system },
    ...(opts.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), 60_000);

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
        temperature: 0.4,
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
