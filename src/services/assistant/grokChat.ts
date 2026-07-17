import type { Repos } from '@/state/AppProvider';
import type { DayKey } from '@/utils/date';
import {
  appendTurn,
  formatMemoryForPrompt,
  loadAssistantMemory,
  saveAssistantMemory,
  type AssistantMemoryStore,
} from './memory';
import { ASSISTANT_TOOLS } from './tools';
import { executeAssistantTool, type ToolInvalidate } from './toolExecutor';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const SYSTEM_PREAMBLE = `You are Macronaut Voice — a warm middle-aged American woman who coaches nutrition and controls the Macronaut calorie tracker app by voice.

Speak in a natural American accent. Final answers must be ONE short spoken sentence (two only if needed). Plain speech, round numbers, no markdown or lists.

You have tools to read and change the user's diary, notes, activities, and goals for any day — including past days. ALWAYS use tools for facts and actions; never invent logged meals or notes.

Memory rules:
- You remember the conversation. If they say "make a note of that", "add that to my notes", or "remember that", use your previous spoken answer as the note body (call add_note).
- Prefer add_note with body set to that previous answer when they refer to "that".
- Use remember_fact only for durable preferences.

When logging food without full macros, estimate calories/protein/carbs/fat reasonably and say you estimated.
Confirm actions briefly after tools succeed ("Got it — I logged the chicken bowl for lunch.").

Efficiency: finish in as few tool calls as possible. To delete a note, call delete_note with contains=<snippet> in ONE step — do not list/find first unless the user is vague.`;

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

async function postChat(opts: {
  key: string;
  model: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  withReasoning: boolean;
  withTools: boolean;
}): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: 0.2,
    max_tokens: opts.withTools ? 500 : 120,
    messages: opts.messages,
  };
  if (opts.withReasoning) body.reasoning_effort = 'low';
  if (opts.withTools) {
    body.tools = ASSISTANT_TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(parseApiError(res.status, errText));
  }

  const data = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ToolCall[];
      };
    }[];
  };
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error('Empty Grok response');
  return {
    content: msg.content?.trim() || null,
    tool_calls: msg.tool_calls,
  };
}

export interface AgentTurnResult {
  answer: string;
  memory: AssistantMemoryStore;
  invalidates: ToolInvalidate[];
}

/** Run one voice turn with tools + durable conversation memory. */
export async function runAssistantAgent(opts: {
  apiKey: string;
  nutritionContext: string;
  question: string;
  repos: Repos;
  selectedDate: DayKey;
  targetMeal: string;
  /** In-memory turns for this session (also persisted). */
  history?: AssistantMessage[];
  model?: string;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}): Promise<AgentTurnResult> {
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Add your Grok API key in Settings first');

  const question = opts.question.trim();
  if (!question) throw new Error('Say or type a question first');

  const model = opts.model ?? 'grok-4.5';
  let memory = await loadAssistantMemory(opts.repos.settings);

  // Prefer the richer of persisted memory vs live session history for chat turns.
  const session = opts.history ?? [];
  const priorTurns =
    memory.turns.length >= session.length
      ? memory.turns
      : session.map((t) => ({
          role: t.role,
          content: t.content,
          at: new Date().toISOString(),
        }));

  const memoryForPrompt: AssistantMemoryStore = {
    ...memory,
    turns: priorTurns,
    lastAnswer: memory.lastAnswer ?? [...priorTurns].reverse().find((t) => t.role === 'assistant')?.content,
  };

  const memoryBlock = formatMemoryForPrompt(memoryForPrompt);
  const system = [
    SYSTEM_PREAMBLE,
    `Today's selected day in the UI: ${opts.selectedDate}. Default meal slot: ${opts.targetMeal}.`,
    `--- Snapshot ---\n${opts.nutritionContext}`,
    memoryBlock ? `--- Memory ---\n${memoryBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    // Recent turns as real chat messages so "that" / follow-ups resolve.
    ...priorTurns.slice(-10).map((t) => ({
      role: t.role as 'user' | 'assistant',
      content: t.content,
    })),
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), 90_000);

  const invalidates: ToolInvalidate[] = [];
  // Seed working memory with session history so "note that" sees the last answer.
  let workingMemory: AssistantMemoryStore = {
    ...memoryForPrompt,
    facts: memory.facts,
  };

  try {
    // Tool rounds + one forced final speak. Deletes/finds used to hit 6 easily.
    const maxToolRounds = 12;
    for (let step = 0; step < maxToolRounds; step++) {
      opts.onStatus?.(step === 0 ? 'Thinking…' : 'Working…');

      let reply: { content: string | null; tool_calls?: ToolCall[] };
      try {
        reply = await postChat({
          key,
          model,
          messages,
          signal: controller.signal,
          withReasoning: false,
          withTools: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (/reasoning|required/i.test(msg)) {
          reply = await postChat({
            key,
            model,
            messages,
            signal: controller.signal,
            withReasoning: true,
            withTools: true,
          });
        } else if (/tools|tool_choice|unknown/i.test(msg) && step === 0) {
          // Fallback: no tools — still answer with memory in the prompt.
          reply = await postChat({
            key,
            model,
            messages: messages.map((m) =>
              m.role === 'tool' ? { role: 'user', content: m.content } : m,
            ) as ChatMessage[],
            signal: controller.signal,
            withReasoning: false,
            withTools: false,
          });
        } else {
          throw e;
        }
      }

      const calls = reply.tool_calls ?? [];
      if (!calls.length) {
        const answer =
          reply.content?.trim() ||
          "Sorry, I couldn't put that into words — try asking again.";
        workingMemory = appendTurn(workingMemory, 'user', question);
        workingMemory = appendTurn(workingMemory, 'assistant', answer);
        await saveAssistantMemory(opts.repos.settings, workingMemory);
        return { answer, memory: workingMemory, invalidates };
      }

      // Append assistant tool-call message, then execute each tool.
      messages.push({
        role: 'assistant',
        content: reply.content,
        tool_calls: calls,
      });

      for (const call of calls) {
        const fnName = call.function?.name ?? '';
        opts.onStatus?.(statusForTool(fnName));
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await executeAssistantTool(fnName, args, {
          repos: opts.repos,
          selectedDate: opts.selectedDate,
          targetMeal: opts.targetMeal,
          memory: workingMemory,
          onMemoryChange: (next) => {
            workingMemory = next;
          },
        });
        invalidates.push(...result.invalidates);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    // Soft landing: force a spoken wrap-up from tool results instead of failing.
    opts.onStatus?.('Wrapping up…');
    messages.push({
      role: 'user',
      content:
        'Stop calling tools. In one short spoken sentence, tell me what you already completed based on the tool results above.',
    });
    const wrap = await postChat({
      key,
      model,
      messages,
      signal: controller.signal,
      withReasoning: false,
      withTools: false,
    });
    const answer =
      wrap.content?.trim() ||
      (invalidates.length
        ? 'Done — I finished the updates I could.'
        : "I couldn't finish that — try asking once more.");
    workingMemory = appendTurn(workingMemory, 'user', question);
    workingMemory = appendTurn(workingMemory, 'assistant', answer);
    await saveAssistantMemory(opts.repos.settings, workingMemory);
    return { answer, memory: workingMemory, invalidates };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

function statusForTool(name: string): string {
  switch (name) {
    case 'add_meal':
    case 'update_diary_entry':
    case 'delete_diary_entries':
      return 'Updating diary…';
    case 'add_note':
    case 'update_note':
    case 'delete_note':
    case 'find_notes':
    case 'list_notes':
      return 'Updating notes…';
    case 'add_activity':
    case 'delete_activity':
    case 'list_activities':
      return 'Updating activity…';
    case 'get_day_summary':
    case 'list_diary_entries':
    case 'get_goals':
      return 'Checking your log…';
    case 'remember_fact':
    case 'recall_memory':
      return 'Remembering…';
    default:
      return 'Working…';
  }
}

/** @deprecated Use runAssistantAgent */
export async function askNutritionAssistant(opts: {
  apiKey: string;
  nutritionContext: string;
  question: string;
  history?: AssistantMessage[];
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  // Legacy path without repos — plain chat only.
  const key = opts.apiKey.trim();
  if (!key) throw new Error('Add your Grok API key in Settings first');
  const question = opts.question.trim();
  if (!question) throw new Error('Say or type a question first');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PREAMBLE}\n\n--- Today ---\n${opts.nutritionContext}`,
    },
    ...(opts.history ?? []).slice(-10).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const reply = await postChat({
      key,
      model: opts.model ?? 'grok-4.5',
      messages,
      signal: controller.signal,
      withReasoning: false,
      withTools: false,
    });
    if (!reply.content) throw new Error('Empty Grok response');
    return reply.content;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
