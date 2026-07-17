import {
  appendTurn,
  formatMemoryForPrompt,
  pinFact,
  type AssistantMemoryStore,
} from '../memory';

describe('assistant memory', () => {
  it('tracks lastAnswer from assistant turns', () => {
    let mem: AssistantMemoryStore = { turns: [], facts: [] };
    mem = appendTurn(mem, 'user', 'How many calories left?');
    mem = appendTurn(mem, 'assistant', 'You have about 500 left.');
    expect(mem.lastAnswer).toBe('You have about 500 left.');
    expect(formatMemoryForPrompt(mem)).toContain('previous spoken answer');
    expect(formatMemoryForPrompt(mem)).toContain('500');
  });

  it('pins facts without duplicates', () => {
    let mem: AssistantMemoryStore = { turns: [], facts: [] };
    mem = pinFact(mem, 'Prefers high protein');
    mem = pinFact(mem, 'prefers high protein');
    expect(mem.facts).toEqual(['prefers high protein']);
  });
});
