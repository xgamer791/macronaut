import type { Repos } from '@/state/AppProvider';
import type { DayKey } from '@/utils/date';
import { fetchWithTimeout, LoopGuard, spokenAbortError } from './agentPolicy';
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

const SYSTEM_PREAMBLE = `You are Macronaut Voice — a warm middle-aged American woman who coaches nutrition and controls the Macronaut calorie tracker by voice.

SPEAKING: Final replies are ONE short spoken sentence (two if clarifying). Plain speech, round numbers, no markdown.

TRUTH: Always use tools for facts and mutations. Never invent logged meals or notes.

DATES:
- Omitted date → the day currently selected in the app UI.
- "today" / "yesterday" / "N days ago" → calendar dates.
- If a date string is unclear, call ask_user — do not guess.

AMBIGUITY: If a tool returns ambiguous:true or candidates, call ask_user (or speak the clarifying question). Never pick randomly.

DELETES: Prefer delete_note/delete_diary_entry with contains=. If multiple match, ask which one. After a bad delete, the user can say "undo".

MEMORY:
- You remember prior turns. For "make a note of that", call add_note with body "that".
- remember_fact for durable preferences; forget_fact to remove them.
- undo_last_action reverses your last add/delete.

AFTER WRITES: If they ask about remaining calories/macros, call get_day_summary again (don't trust the opening snapshot).

LOGGING: If macros aren't given, estimate and say you estimated. Always say the meal slot and date in your confirmation.

CLARIFY: Prefer ask_user over wrong actions.`;

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
    max_tokens: opts.withTools ? 600 : 140,
    messages: opts.messages,
  };
  if (opts.withReasoning) body.reasoning_effort = 'low';
  if (opts.withTools) {
    body.tools = ASSISTANT_TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetchWithTimeout(
    'https://api.x.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.key}`,
      },
      body: JSON.stringify(body),
    },
    28_000,
    opts.signal,
  );

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
    lastAnswer:
      memory.lastAnswer ??
      [...priorTurns].reverse().find((t) => t.role === 'assistant')?.content,
  };

  const memoryBlock = formatMemoryForPrompt(memoryForPrompt);
  const system = [
    SYSTEM_PREAMBLE,
    `Selected day in the UI (default when date omitted): ${opts.selectedDate}. Default meal slot: ${opts.targetMeal}.`,
    `--- Snapshot at turn start (may go stale after writes; re-fetch with get_day_summary) ---\n${opts.nutritionContext}`,
    memoryBlock ? `--- Memory ---\n${memoryBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
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
  let workingMemory: AssistantMemoryStore = {
    ...memoryForPrompt,
    facts: memory.facts,
    undoStack: memory.undoStack,
    recentMutations: memory.recentMutations,
  };
  const loopGuard = new LoopGuard();
  let lastToolOk: boolean | null = null;
  let mutationCount = 0;

  const finish = async (answer: string): Promise<AgentTurnResult> => {
    workingMemory = appendTurn(workingMemory, 'user', question);
    workingMemory = appendTurn(workingMemory, 'assistant', answer);
    await saveAssistantMemory(opts.repos.settings, workingMemory);
    return { answer, memory: workingMemory, invalidates };
  };

  try {
    const maxToolRounds = 12;
    for (let step = 0; step < maxToolRounds; step++) {
      opts.onStatus?.(
        step === 0 ? 'Thinking…' : `Working… (${step}/${maxToolRounds})`,
      );

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
        const abortMsg = spokenAbortError(e);
        if (abortMsg) return finish(abortMsg);
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
          // Tools unavailable — answer read-only.
          const readOnly = [
            {
              role: 'system' as const,
              content:
                'Tools are temporarily unavailable. Answer from the snapshot only. Do not claim you changed the diary or notes.',
            },
            { role: 'user' as const, content: question },
          ];
          reply = await postChat({
            key,
            model,
            messages: readOnly,
            signal: controller.signal,
            withReasoning: false,
            withTools: false,
          });
          return finish(
            reply.content?.trim() ||
              "I can talk right now, but I can't change your diary until tools come back.",
          );
        } else {
          throw e;
        }
      }

      const calls = reply.tool_calls ?? [];
      if (!calls.length) {
        let answer =
          reply.content?.trim() ||
          "Sorry, I couldn't put that into words — try asking again.";
        if (lastToolOk === false && /saved|deleted|logged|done|got it/i.test(answer)) {
          answer = "That didn't go through — try again, or tell me more specifically.";
        }
        return finish(answer);
      }

      messages.push({
        role: 'assistant',
        content: reply.content,
        tool_calls: calls,
      });

      for (const call of calls) {
        const fnName = call.function?.name ?? '';
        opts.onStatus?.(statusForTool(fnName, step, maxToolRounds));
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }

        const fp = `${fnName}:${JSON.stringify(args)}`;
        const result = await executeAssistantTool(fnName, args, {
          repos: opts.repos,
          selectedDate: opts.selectedDate,
          targetMeal: opts.targetMeal,
          memory: workingMemory,
          onMemoryChange: (next) => {
            workingMemory = next;
          },
        });

        lastToolOk = result.ok;
        if (result.ok) loopGuard.noteSuccess(fp);
        else if (loopGuard.noteFailure(fp)) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              ...((result.data as object) ?? {}),
              stuck: true,
              error: 'Identical tool call failed twice — ask the user instead of retrying.',
            }),
          });
          invalidates.push(...result.invalidates);
          const stuckAnswer =
            result.speakNow ||
            "I'm stuck on that action — can you say it another way?";
          return finish(stuckAnswer);
        }

        invalidates.push(...result.invalidates);
        if (result.invalidates.some((i) => i.kind !== 'memory')) mutationCount += 1;

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result.data),
        });

        // Clarifying questions / undo spoken shortcuts end the turn immediately.
        if (result.speakNow) {
          return finish(result.speakNow);
        }
      }

      // After mutations, nudge the model to re-read if needed (appended once).
      if (mutationCount > 0 && step === 0) {
        /* no-op: prompt already tells it to re-fetch */
      }
    }

    opts.onStatus?.('Wrapping up…');
    messages.push({
      role: 'user',
      content:
        'Stop calling tools. In one short spoken sentence, honestly say what you completed or what is still unclear. Do not claim success if tools failed.',
    });
    let wrap: { content: string | null };
    try {
      wrap = await postChat({
        key,
        model,
        messages,
        signal: controller.signal,
        withReasoning: false,
        withTools: false,
      });
    } catch (e) {
      const abortMsg = spokenAbortError(e);
      if (abortMsg) return finish(abortMsg);
      throw e;
    }

    const answer =
      wrap.content?.trim() ||
      (lastToolOk === false
        ? "That didn't fully work — try asking once more."
        : mutationCount > 0
          ? 'I finished the updates I could.'
          : "I couldn't finish that — try asking once more.");
    return finish(answer);
  } catch (e) {
    const abortMsg = spokenAbortError(e);
    if (abortMsg) return finish(abortMsg);
    throw e;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

function statusForTool(name: string, step: number, max: number): string {
  const prefix = `Step ${step + 1}/${max} · `;
  switch (name) {
    case 'add_meal':
    case 'update_diary_entry':
    case 'delete_diary_entry':
    case 'delete_diary_entries':
    case 'find_diary_entries':
      return `${prefix}Diary`;
    case 'add_note':
    case 'update_note':
    case 'delete_note':
    case 'find_notes':
    case 'list_notes':
      return `${prefix}Notes`;
    case 'add_activity':
    case 'delete_activity':
    case 'list_activities':
      return `${prefix}Activity`;
    case 'get_day_summary':
    case 'list_diary_entries':
    case 'get_goals':
      return `${prefix}Checking log`;
    case 'ask_user':
      return `${prefix}Need a detail`;
    case 'undo_last_action':
      return `${prefix}Undoing`;
    case 'remember_fact':
    case 'forget_fact':
    case 'recall_memory':
      return `${prefix}Memory`;
    default:
      return `${prefix}Working`;
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
