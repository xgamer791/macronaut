import { createTestDb } from '@/db/__tests__/testDb';
import { createDayNotesRepo } from '@/repositories/dayNotesRepo';
import { createSettingsRepo } from '@/repositories/settingsRepo';
import { executeAssistantTool } from '../toolExecutor';

describe('executeAssistantTool delete_note', () => {
  it('deletes by contains text in one call', async () => {
    const db = await createTestDb();
    const dayNotes = createDayNotesRepo(db);
    const settings = createSettingsRepo(db);
    await dayNotes.add('2026-07-17', 'Protein tip: aim for 150g');
    await dayNotes.add('2026-07-17', 'Grocery: buy eggs');

    const result = await executeAssistantTool(
      'delete_note',
      { contains: 'grocery' },
      {
        repos: { dayNotes, settings } as never,
        selectedDate: '2026-07-17',
        targetMeal: 'lunch',
        memory: { turns: [], facts: [] },
        onMemoryChange: () => {},
      },
    );

    expect(result.ok).toBe(true);
    const left = await dayNotes.listForDate('2026-07-17');
    expect(left.map((n) => n.body)).toEqual(['Protein tip: aim for 150g']);
  });
});
