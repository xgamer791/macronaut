import type { Nutrition } from '@/domain/types';
import type { SettingsRepo } from '@/repositories/settingsRepo';
import type { DayKey } from '@/utils/date';

export interface MemoryTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

/** Enough info to reverse the last mutating action. */
export type UndoRecord =
  | {
      kind: 'add_note';
      id: string;
      date: DayKey;
      summary: string;
    }
  | {
      kind: 'delete_note';
      date: DayKey;
      body: string;
      summary: string;
    }
  | {
      kind: 'add_meal';
      id: string;
      date: DayKey;
      summary: string;
    }
  | {
      kind: 'delete_meal';
      date: DayKey;
      meal: string;
      name: string;
      quantity: number;
      unit: string;
      nutrition: Nutrition;
      notes?: string;
      summary: string;
    }
  | {
      kind: 'add_activity';
      id: string;
      date: DayKey;
      summary: string;
    };

export interface AssistantMemoryStore {
  turns: MemoryTurn[];
  lastAnswer?: string;
  facts: string[];
  /** Stack of reversible mutations (newest last). */
  undoStack: UndoRecord[];
  /** Recent mutating tool fingerprints for idempotency within a session window. */
  recentMutations: { fp: string; at: string; resultSummary: string }[];
  updatedAt?: string;
}

const MEMORY_KEY = 'assistantMemory';
const MAX_TURNS = 24;
const MAX_FACTS = 40;
const MAX_UNDO = 8;
const MAX_MUTATIONS = 40;

export const EMPTY_MEMORY: AssistantMemoryStore = {
  turns: [],
  facts: [],
  undoStack: [],
  recentMutations: [],
};

export async function loadAssistantMemory(settings: SettingsRepo): Promise<AssistantMemoryStore> {
  const raw = await settings.get<Partial<AssistantMemoryStore> | null>(MEMORY_KEY, null);
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MEMORY };
  return {
    turns: Array.isArray(raw.turns) ? raw.turns.slice(-MAX_TURNS) : [],
    lastAnswer: typeof raw.lastAnswer === 'string' ? raw.lastAnswer : undefined,
    facts: Array.isArray(raw.facts) ? raw.facts.slice(-MAX_FACTS) : [],
    undoStack: Array.isArray(raw.undoStack) ? (raw.undoStack as UndoRecord[]).slice(-MAX_UNDO) : [],
    recentMutations: Array.isArray(raw.recentMutations)
      ? raw.recentMutations.slice(-MAX_MUTATIONS)
      : [],
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
    undoStack: memory.undoStack.slice(-MAX_UNDO),
    recentMutations: memory.recentMutations.slice(-MAX_MUTATIONS),
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
  const facts = [
    ...memory.facts.filter((f) => f.toLowerCase() !== clean.toLowerCase()),
    clean,
  ].slice(-MAX_FACTS);
  return { ...memory, facts };
}

export function forgetFact(memory: AssistantMemoryStore, query: string): AssistantMemoryStore {
  const q = query.trim().toLowerCase();
  if (!q) return memory;
  return {
    ...memory,
    facts: memory.facts.filter((f) => !f.toLowerCase().includes(q)),
  };
}

export function pushUndo(memory: AssistantMemoryStore, record: UndoRecord): AssistantMemoryStore {
  return { ...memory, undoStack: [...memory.undoStack, record].slice(-MAX_UNDO) };
}

export function popUndo(
  memory: AssistantMemoryStore,
): { memory: AssistantMemoryStore; record: UndoRecord | null } {
  if (!memory.undoStack.length) return { memory, record: null };
  const record = memory.undoStack[memory.undoStack.length - 1]!;
  return {
    memory: { ...memory, undoStack: memory.undoStack.slice(0, -1) },
    record,
  };
}

/** Return cached result if the same mutating call happened in the last 2 minutes. */
export function findRecentMutation(
  memory: AssistantMemoryStore,
  fp: string,
  withinMs = 120_000,
): string | null {
  const now = Date.now();
  for (let i = memory.recentMutations.length - 1; i >= 0; i--) {
    const m = memory.recentMutations[i]!;
    if (m.fp !== fp) continue;
    const age = now - Date.parse(m.at);
    if (Number.isFinite(age) && age >= 0 && age <= withinMs) return m.resultSummary;
  }
  return null;
}

export function rememberMutation(
  memory: AssistantMemoryStore,
  fp: string,
  resultSummary: string,
): AssistantMemoryStore {
  return {
    ...memory,
    recentMutations: [
      ...memory.recentMutations,
      { fp, at: new Date().toISOString(), resultSummary },
    ].slice(-MAX_MUTATIONS),
  };
}

/** Compact memory for the system prompt — avoid duplicating full chat turns here. */
export function formatMemoryForPrompt(memory: AssistantMemoryStore): string {
  const lines: string[] = [];
  if (memory.lastAnswer) {
    lines.push(
      `Your previous spoken answer (use for "that" / "make a note of that"): ${memory.lastAnswer}`,
    );
  }
  if (memory.facts.length) {
    lines.push(`Pinned facts:\n${memory.facts.map((f) => `- ${f}`).join('\n')}`);
  }
  if (memory.undoStack.length) {
    const last = memory.undoStack[memory.undoStack.length - 1]!;
    lines.push(`Last undoable action: ${last.summary}`);
  }
  return lines.join('\n\n');
}

export function recallFriendly(memory: AssistantMemoryStore): Record<string, unknown> {
  return {
    lastAnswer: memory.lastAnswer ?? null,
    facts: memory.facts,
    recentTurns: memory.turns.slice(-12),
    canUndo: memory.undoStack.length > 0,
    lastUndoable: memory.undoStack[memory.undoStack.length - 1]?.summary ?? null,
  };
}
