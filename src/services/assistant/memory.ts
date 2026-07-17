import type { SettingsRepo } from '@/repositories/settingsRepo';

export interface MemoryTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export interface AssistantMemoryStore {
  /** Recent conversational turns (newest last). */
  turns: MemoryTurn[];
  /** Last spoken assistant answer — used for "note that" / "remember that". */
  lastAnswer?: string;
  /** Pinned long-term facts. */
  facts: string[];
  updatedAt?: string;
}

const MEMORY_KEY = 'assistantMemory';
const MAX_TURNS = 24;
const MAX_FACTS = 40;

export const EMPTY_MEMORY: AssistantMemoryStore = { turns: [], facts: [] };

export async function loadAssistantMemory(settings: SettingsRepo): Promise<AssistantMemoryStore> {
  const raw = await settings.get<AssistantMemoryStore | null>(MEMORY_KEY, null);
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MEMORY };
  return {
    turns: Array.isArray(raw.turns) ? raw.turns.slice(-MAX_TURNS) : [],
    lastAnswer: typeof raw.lastAnswer === 'string' ? raw.lastAnswer : undefined,
    facts: Array.isArray(raw.facts) ? raw.facts.slice(-MAX_FACTS) : [],
    updatedAt: raw.updatedAt,
  };
}

export async function saveAssistantMemory(
  settings: SettingsRepo,
  memory: AssistantMemoryStore,
): Promise<void> {
  await settings.set(MEMORY_KEY, {
    turns: memory.turns.slice(-MAX_TURNS),
    lastAnswer: memory.lastAnswer,
    facts: memory.facts.slice(-MAX_FACTS),
    updatedAt: new Date().toISOString(),
  } satisfies AssistantMemoryStore);
}

export function appendTurn(
  memory: AssistantMemoryStore,
  role: 'user' | 'assistant',
  content: string,
): AssistantMemoryStore {
  const turn: MemoryTurn = { role, content, at: new Date().toISOString() };
  const turns = [...memory.turns, turn].slice(-MAX_TURNS);
  return {
    ...memory,
    turns,
    lastAnswer: role === 'assistant' ? content : memory.lastAnswer,
  };
}

export function pinFact(memory: AssistantMemoryStore, fact: string): AssistantMemoryStore {
  const clean = fact.trim();
  if (!clean) return memory;
  const facts = [...memory.facts.filter((f) => f.toLowerCase() !== clean.toLowerCase()), clean].slice(
    -MAX_FACTS,
  );
  return { ...memory, facts };
}

/** Compact memory block for the system prompt. */
export function formatMemoryForPrompt(memory: AssistantMemoryStore): string {
  const lines: string[] = [];
  if (memory.lastAnswer) {
    lines.push(
      `Your previous spoken answer (use this if they say "that" / "make a note of that"): ${memory.lastAnswer}`,
    );
  }
  if (memory.facts.length) {
    lines.push(`Pinned facts:\n${memory.facts.map((f) => `- ${f}`).join('\n')}`);
  }
  const recent = memory.turns.slice(-12);
  if (recent.length) {
    lines.push(
      `Recent conversation:\n${recent.map((t) => `${t.role}: ${t.content}`).join('\n')}`,
    );
  }
  return lines.join('\n\n');
}

export function recallFriendly(memory: AssistantMemoryStore): Record<string, unknown> {
  return {
    lastAnswer: memory.lastAnswer ?? null,
    facts: memory.facts,
    recentTurns: memory.turns.slice(-12),
  };
}
