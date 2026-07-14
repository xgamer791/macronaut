import { createTestDb } from '@/db/__tests__/testDb';
import { createDayNotesRepo } from '../dayNotesRepo';

describe('dayNotesRepo', () => {
  it('stores, updates, and clears a day note', async () => {
    const repo = createDayNotesRepo(await createTestDb());
    expect(await repo.get('2026-07-14')).toBeNull();

    const saved = await repo.set('2026-07-14', '  Felt strong today  ');
    expect(saved?.body).toBe('Felt strong today');
    expect((await repo.get('2026-07-14'))?.body).toBe('Felt strong today');

    await repo.set('2026-07-14', 'Updated');
    expect((await repo.get('2026-07-14'))?.body).toBe('Updated');

    expect(await repo.set('2026-07-14', '   ')).toBeNull();
    expect(await repo.get('2026-07-14')).toBeNull();
  });

  it('lists dates with notes in a range', async () => {
    const repo = createDayNotesRepo(await createTestDb());
    await repo.set('2026-07-10', 'A');
    await repo.set('2026-07-14', 'B');
    await repo.set('2026-07-20', 'C');
    expect(await repo.datesWithNotes('2026-07-12', '2026-07-18')).toEqual(['2026-07-14']);
  });
});
