import { createTestDb } from '@/db/__tests__/testDb';
import { createDayNotesRepo } from '@/repositories/dayNotesRepo';
import { createDiaryRepo } from '@/repositories/diaryRepo';
import { createSettingsRepo } from '@/repositories/settingsRepo';
import { executeAssistantTool } from '../toolExecutor';
import type { AssistantMemoryStore } from '../memory';

function emptyMem(): AssistantMemoryStore {
  return { turns: [], facts: [], undoStack: [], recentMutations: [] };
}

describe('executeAssistantTool reliability', () => {
  it('deletes by contains when unique', async () => {
    const db = await createTestDb();
    const dayNotes = createDayNotesRepo(db);
    const settings = createSettingsRepo(db);
    await dayNotes.add('2026-07-17', 'Protein tip: aim for 150g');
    await dayNotes.add('2026-07-17', 'Grocery: buy eggs');

    let mem = emptyMem();
    const result = await executeAssistantTool(
      'delete_note',
      { contains: 'grocery' },
      {
        repos: { dayNotes, settings } as never,
        selectedDate: '2026-07-17',
        targetMeal: 'lunch',
        memory: mem,
        onMemoryChange: (n) => {
          mem = n;
        },
      },
    );

    expect(result.ok).toBe(true);
    const left = await dayNotes.listForDate('2026-07-17');
    expect(left.map((n) => n.body)).toEqual(['Protein tip: aim for 150g']);
    expect(mem.undoStack.length).toBe(1);
  });

  it('refuses ambiguous note deletes', async () => {
    const db = await createTestDb();
    const dayNotes = createDayNotesRepo(db);
    const settings = createSettingsRepo(db);
    await dayNotes.add('2026-07-17', 'Calories look good');
    await dayNotes.add('2026-07-17', 'Calories were high yesterday');

    const result = await executeAssistantTool(
      'delete_note',
      { contains: 'calories' },
      {
        repos: { dayNotes, settings } as never,
        selectedDate: '2026-07-17',
        targetMeal: 'lunch',
        memory: emptyMem(),
        onMemoryChange: () => {},
      },
    );

    expect(result.ok).toBe(false);
    expect((result.data as { ambiguous?: boolean }).ambiguous).toBe(true);
    expect(result.speakNow).toMatch(/which one/i);
    expect((await dayNotes.listForDate('2026-07-17')).length).toBe(2);
  });

  it('rejects unparseable dates instead of silently using today', async () => {
    const db = await createTestDb();
    const result = await executeAssistantTool(
      'get_day_summary',
      { date: 'next eon' },
      {
        repos: {
          dayNotes: createDayNotesRepo(db),
          settings: createSettingsRepo(db),
          diary: createDiaryRepo(db),
          activity: { totalBurnedForDate: async () => 0 },
          goals: { configFor: async () => null, getMarks: async () => ({}) },
        } as never,
        selectedDate: '2026-07-17',
        targetMeal: 'lunch',
        memory: emptyMem(),
        onMemoryChange: () => {},
      },
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.data)).toMatch(/understand/i);
  });
});
