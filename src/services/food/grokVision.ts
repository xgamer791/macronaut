import { Nutrition } from '@/domain/types';
import { ServingUnit } from '@/domain/serving';

export interface GrokFoodEstimate {
  name: string;
  brand?: string;
  servingQty: number;
  servingUnit: ServingUnit | string;
  gramsPerServing?: number;
  nutrition: Nutrition;
  /** 0..1 model confidence. */
  confidence: number;
  notes?: string;
}

const PROMPT = `You are a nutrition expert helping log a meal from a photo.
Identify the food (and brand if visible), estimate the edible portion weight/serving, and estimate nutrition for that portion.
Return ONLY a single JSON object with no markdown fences:
{
  "name": string,
  "brand": string | null,
  "servingQty": number,
  "servingUnit": "g" | "ml" | "serving" | "cup" | "piece" | "slice" | "container",
  "gramsPerServing": number | null,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number | null,
  "confidence": number,
  "notes": string
}
confidence is 0..1. calories/macros are for the estimated portion shown. Be realistic.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Grok did not return JSON');
  }
}

function parseEstimate(raw: unknown): GrokFoodEstimate {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid Grok food payload');
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? '').trim();
  if (!name) throw new Error('Grok could not name the food');
  const calories = Number(o.calories);
  if (!Number.isFinite(calories) || calories < 0) throw new Error('Invalid calorie estimate');

  const nutrition: Nutrition = { calories: Math.round(calories) };
  const protein = Number(o.protein);
  const carbs = Number(o.carbs);
  const fat = Number(o.fat);
  const fiber = Number(o.fiber);
  if (Number.isFinite(protein)) nutrition.protein = Math.round(protein * 10) / 10;
  if (Number.isFinite(carbs)) nutrition.carbs = Math.round(carbs * 10) / 10;
  if (Number.isFinite(fat)) nutrition.fat = Math.round(fat * 10) / 10;
  if (Number.isFinite(fiber)) nutrition.fiber = Math.round(fiber * 10) / 10;

  const servingQty = Number(o.servingQty);
  const grams = Number(o.gramsPerServing);
  const confidence = Number(o.confidence);

  return {
    name,
    brand: o.brand ? String(o.brand) : undefined,
    servingQty: Number.isFinite(servingQty) && servingQty > 0 ? servingQty : 1,
    servingUnit: (o.servingUnit as string) || 'serving',
    gramsPerServing: Number.isFinite(grams) && grams > 0 ? grams : undefined,
    nutrition,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    notes: o.notes ? String(o.notes) : undefined,
  };
}

function textFromResponsesPayload(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const output = data.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const p = part as { type?: string; text?: string };
        if ((p.type === 'output_text' || p.type === 'text') && typeof p.text === 'string') {
          chunks.push(p.text);
        }
      }
    }
    if (chunks.length) return chunks.join('\n');
  }
  throw new Error('Unexpected Grok response shape');
}

/** Analyze a food photo with the user-supplied xAI Grok key (on-device only). */
export async function analyzeFoodPhoto(opts: {
  apiKey: string;
  /** data:image/jpeg;base64,... or data:image/png;base64,... */
  dataUrl: string;
  model?: string;
}): Promise<GrokFoodEstimate> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Add your Grok API key in Settings first');

  const model = opts.model ?? 'grok-4.5';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    // Prefer Responses API (current xAI vision docs).
    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_image', image_url: opts.dataUrl, detail: 'high' },
              { type: 'input_text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      // Fallback: OpenAI-compatible chat completions (some keys/models prefer this).
      if (res.status === 404 || res.status === 400) {
        return analyzeViaChatCompletions(key, model, opts.dataUrl, controller.signal);
      }
      const errText = await res.text().catch(() => '');
      throw new Error(parseApiError(res.status, errText));
    }

    const data = (await res.json()) as Record<string, unknown>;
    return parseEstimate(extractJson(textFromResponsesPayload(data)));
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeViaChatCompletions(
  key: string,
  model: string,
  dataUrl: string,
  signal: AbortSignal,
): Promise<GrokFoodEstimate> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(parseApiError(res.status, errText));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty Grok chat response');
  return parseEstimate(extractJson(text));
}

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
