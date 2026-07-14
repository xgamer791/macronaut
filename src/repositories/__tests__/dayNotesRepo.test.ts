import { createTestDb } from '@/db/__tests__/testDb';
import { createDayNotesRepo } from '../dayNotesRepo';

describe('dayNotesRepo', () => {
  it('adds, updates, and removes multiple notes per day', async () => {
    const repo = createDayNotesRepo(await createTestDb());
    expect(await repo.listForDate('2026-07-14')).toEqual([]);

    const a = await repo.add('2026-07-14', '  Felt strong  ');
    const b = await repo.add('2026-07-14', 'Late snack note');
    expect(a.body).toBe('Felt strong');
    expect((await repo.listForDate('2026-07-14')).map((n) => n.body)).toEqual([
      'Felt strong',
      'Late snack note',
    ]);

    const updated = await repo.update(a.id, 'Felt stronger');
    expect(updated.body).toBe('Felt stronger');

    await repo.remove(b.id);
    expect((await repo.listForDate('2026-07-14')).map((n) => n.body)).toEqual(['Felt stronger']);

    await expect(repo.add('2026-07-14', '   ')).rejects.toThrow(/empty/i);
  });

  it('lists distinct dates with notes in a range', async () => {
    const repo = createDayNotesRepo(await createTestDb());
    await repo.add('2026-07-10', 'A');
    await repo.add('2026-07-14', 'B1');
    await repo.add('2026-07-14', 'B2');
    await repo.add('2026-07-20', 'C');
    expect(await repo.datesWithNotes('2026-07-12', '2026-07-18')).toEqual(['2026-07-14']);
  });
});
