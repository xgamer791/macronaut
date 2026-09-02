import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb } from '@/db/__tests__/testDb';
import { Database } from '@/db/driver';
import { pendingCount, syncOnce } from '../engine';
import { SYNC_TABLES, syncTable } from '../tables';
import { FakeRemote } from './fakeRemote';

const diary = syncTable('diary_entries');
const settings = syncTable('settings');

async function addEntry(db: Database, id: string, name: string, date = '2026-03-01') {
  await db.runAsync(
    `INSERT INTO diary_entries
       (id, date, meal, name, source_type, quantity, unit, nutrition, created_at, updated_at)
     VALUES (?, ?, 'breakfast', ?, 'custom', 1, 'serving', '{}', '2026-03-01T08:00:00Z', '2026-03-01T08:00:00Z')`,
    [id, date, name],
  );
}

async function entryNames(db: Database): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM diary_entries ORDER BY name',
  );
  return rows.map((r) => r.name);
}

describe('sync outbox triggers', () => {
  it('queues every write without repositories knowing', async () => {
    const db = await createTestDb();
    await db.runAsync('DELETE FROM sync_outbox');

    await addEntry(db, 'e1', 'Oats');
    let queued = await db.getAllAsync<{ table_name: string; op: string }>(
      'SELECT table_name, op FROM sync_outbox',
    );
    expect(queued).toEqual([{ table_name: 'diary_entries', op: 'upsert' }]);

    await db.runAsync('DELETE FROM diary_entries WHERE id = ?', ['e1']);
    queued = await db.getAllAsync('SELECT table_name, op FROM sync_outbox');
    expect(queued).toEqual([{ table_name: 'diary_entries', op: 'delete' }]);
  });

  it('collapses repeated edits of one row into a single pending change', async () => {
    const db = await createTestDb();
    await db.runAsync('DELETE FROM sync_outbox');

    await addEntry(db, 'e1', 'Oats');
    for (let i = 0; i < 5; i++) {
      await db.runAsync('UPDATE diary_entries SET name = ? WHERE id = ?', [`Oats ${i}`, 'e1']);
    }

    expect(await pendingCount(db)).toBe(1);
  });

  it('seeds existing rows so an upgrade uploads the diary already on the device', async () => {
    // The migration chain creates the built-in meal categories before the
    // outbox exists; they must still be queued once it does.
    const db = await createTestDb();
    const queued = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'meal_categories'`,
    );
    expect(queued?.n).toBeGreaterThan(0);
  });

  it('covers every table the schema declares as account-owned', async () => {
    const db = await createTestDb();
    const triggers = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'`,
    );
    const names = new Set(triggers.map((t) => t.name));
    for (const table of SYNC_TABLES) {
      expect(names.has(`sync_${table.name}_ai`)).toBe(true);
      expect(names.has(`sync_${table.name}_au`)).toBe(true);
      expect(names.has(`sync_${table.name}_ad`)).toBe(true);
    }
  });
});

describe('verify-sync script', () => {
  it('checks every table the engine actually syncs', () => {
    // The script is plain Node and re-lists the tables by hand; a table added
    // to SYNC_TABLES but not there would go unverified against the live project.
    const script = readFileSync(join(__dirname, '../../../../scripts/verify-sync.mjs'), 'utf8');
    for (const table of SYNC_TABLES) {
      expect(script).toContain(`'${table.name}'`);
    }
  });
});

describe('syncOnce', () => {
  it('uploads local changes and empties the outbox', async () => {
    const db = await createTestDb();
    const remote = new FakeRemote();

    await addEntry(db, 'e1', 'Oats');
    const result = await syncOnce(db, remote);

    expect(result.pushed).toBeGreaterThan(0);
    expect(await pendingCount(db)).toBe(0);
    expect(remote.rowsFor(diary).map((r) => r.name)).toEqual(['Oats']);
  });

  it('carries a diary from one device to another', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await addEntry(phone, 'e1', 'Oats');
    await addEntry(phone, 'e2', 'Yoghurt');
    await syncOnce(phone, remote);

    expect(await entryNames(laptop)).toEqual([]);
    await syncOnce(laptop, remote);
    expect(await entryNames(laptop)).toEqual(['Oats', 'Yoghurt']);
  });

  it('propagates deletions instead of resurrecting the row', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await addEntry(phone, 'e1', 'Oats');
    await syncOnce(phone, remote);
    await syncOnce(laptop, remote);
    expect(await entryNames(laptop)).toEqual(['Oats']);

    await phone.runAsync('DELETE FROM diary_entries WHERE id = ?', ['e1']);
    await syncOnce(phone, remote);
    await syncOnce(laptop, remote);

    expect(await entryNames(laptop)).toEqual([]);
    // And the laptop must not push the row back up on its next pass.
    await syncOnce(laptop, remote);
    await syncOnce(phone, remote);
    expect(await entryNames(phone)).toEqual([]);
  });

  it('does not echo pulled rows back to the server', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await addEntry(phone, 'e1', 'Oats');
    await syncOnce(phone, remote);
    await syncOnce(laptop, remote);

    expect(await pendingCount(laptop)).toBe(0);
  });

  it('settles instead of ping-ponging when both devices keep syncing', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await addEntry(phone, 'e1', 'Oats');
    for (let i = 0; i < 3; i++) {
      await syncOnce(phone, remote);
      await syncOnce(laptop, remote);
    }

    const last = await syncOnce(laptop, remote);
    expect(last.pushed).toBe(0);
    expect(last.pulled).toBe(0);
  });

  it('keeps a local edit made while a push is in flight', async () => {
    const remote = new FakeRemote();
    const db = await createTestDb();
    await addEntry(db, 'e1', 'Oats');
    await syncOnce(db, remote);

    // Slow server: the row changes again after upload starts but before the
    // outbox is cleared.
    const slow = new FakeRemote();
    let editDuring: Promise<unknown> | null = null;
    const wrapped: typeof slow = Object.create(slow);
    wrapped.upsert = async (table, rows) => {
      editDuring ??= db.runAsync('UPDATE diary_entries SET name = ? WHERE id = ?', [
        'Porridge',
        'e1',
      ]);
      await editDuring;
      return slow.upsert(table, rows);
    };

    await db.runAsync('UPDATE diary_entries SET name = ? WHERE id = ?', ['Oatmeal', 'e1']);
    await syncOnce(db, wrapped);

    expect(await pendingCount(db)).toBe(1);
  });

  it('syncs settings, so an account keeps its profile across devices', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await phone.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'units',
      '"imperial"',
    ]);
    await syncOnce(phone, remote);
    await syncOnce(laptop, remote);

    const row = await laptop.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['units'],
    );
    expect(row?.value).toBe('"imperial"');
    expect(remote.rowsFor(settings).length).toBeGreaterThan(0);
  });

  it('resumes from its cursor rather than re-reading the whole table', async () => {
    const remote = new FakeRemote();
    const phone = await createTestDb();
    const laptop = await createTestDb();

    await addEntry(phone, 'e1', 'Oats');
    await syncOnce(phone, remote);
    await syncOnce(laptop, remote);

    await addEntry(phone, 'e2', 'Yoghurt');
    await syncOnce(phone, remote);
    const second = await syncOnce(laptop, remote);

    expect(second.pulled).toBe(1);
    expect(await entryNames(laptop)).toEqual(['Oats', 'Yoghurt']);
  });
});
