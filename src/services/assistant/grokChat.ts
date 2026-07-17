export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PREAMBLE = `You are Macronaut Voice — a warm middle-aged American woman coaching nutrition out loud.
Speak in a natural American accent. Answer in ONE short spoken sentence (two only if needed). Plain speech, round numbers, no markdown or lists.
Help with remaining calories/macros, food ideas, protein, and food comparisons.
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

async function postChat(
  key: string,
  model: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  withReasoning: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: 60,
    messages,
  };
  if (withReasoning) body.reasoning_effort = 'low';

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
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

  // Prefer a snappy reply — skip conversation history for turn latency.
  const model = opts.model ?? 'grok-4.5';
  const system = `${SYSTEM_PREAMBLE}\n\n--- Today ---\n${opts.nutritionContext}`;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    // Try without reasoning first — much faster for short spoken answers.
    try {
      return await postChat(key, model, messages, controller.signal, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Some deployments require reasoning_effort — retry low once.
      if (/reasoning|required/i.test(msg)) {
        return await postChat(key, model, messages, controller.signal, true);
      }
      throw e;
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
