import BetterSqlite3 from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createNodeDriver } from '../nodeDriver';
import { migrate } from '../migrations';
import { createDiaryRepo } from '@/repositories/diaryRepo';
import { createSettingsRepo } from '@/repositories/settingsRepo';

/** Simulates an app restart: write → close → reopen the same file → read. */
describe('persistence across restart', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'macronaut-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('diary entries and settings survive close/reopen', async () => {
    const file = join(dir, 'app.db');

    // Session 1: migrate, write, close.
    const raw1 = new BetterSqlite3(file);
    const db1 = createNodeDriver(raw1);
    await migrate(db1);
    const diary1 = createDiaryRepo(db1);
    const settings1 = createSettingsRepo(db1);
    await diary1.add({
      date: '2026-07-13',
      meal: 'lunch',
      name: 'Burrito',
      sourceType: 'manual',
      quantity: 1,
      unit: 'serving',
      nutrition: { calories: 560, protein: 28 },
    });
    await settings1.setOnboardingComplete(true);
    await settings1.setWeekStart('sunday');
    raw1.close();

    // Session 2: reopen, migrate (no-op), read everything back.
    const raw2 = new BetterSqlite3(file);
    const db2 = createNodeDriver(raw2);
    const applied = await migrate(db2);
    expect(applied).toBe(0); // idempotent on restart

    const diary2 = createDiaryRepo(db2);
    const settings2 = createSettingsRepo(db2);
    const entries = await diary2.entriesForDate('2026-07-13');
    expect(entries).toHaveLength(1);
    expect(entries[0].nutrition.calories).toBe(560);
    expect(await settings2.getOnboardingComplete()).toBe(true);
    expect(await settings2.getWeekStart()).toBe('sunday');
    raw2.close();
  });
});
