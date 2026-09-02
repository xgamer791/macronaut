import { CURSOR, DELETED, PullPage, RemoteStore, Row } from '../remote';
import { SyncTable, rowKey } from '../tables';

/** In-memory stand-in for the Supabase tables, shared by every "device" in a
 * test. Mirrors the behaviour the SQL migration sets up: rows are keyed by
 * primary key, deletes leave tombstones, and every write bumps a monotonic
 * cursor so pulls can ask for "anything newer than this". */
export class FakeRemote implements RemoteStore {
  private readonly data = new Map<string, Map<string, Row>>();
  private clock = 0;

  private tableRows(table: SyncTable): Map<string, Row> {
    let rows = this.data.get(table.name);
    if (!rows) {
      rows = new Map();
      this.data.set(table.name, rows);
    }
    return rows;
  }

  private stamp(): string {
    this.clock += 1;
    return String(this.clock).padStart(12, '0');
  }

  async upsert(table: SyncTable, rows: Row[]): Promise<void> {
    const store = this.tableRows(table);
    for (const row of rows) {
      store.set(rowKey(table, row), { ...row, [DELETED]: false, [CURSOR]: this.stamp() });
    }
  }

  async remove(table: SyncTable, keys: Row[]): Promise<void> {
    const store = this.tableRows(table);
    for (const key of keys) {
      store.set(rowKey(table, key), { ...key, [DELETED]: true, [CURSOR]: this.stamp() });
    }
  }

  async pull(table: SyncTable, since: string | null, limit: number): Promise<PullPage> {
    const all = [...this.tableRows(table).values()]
      .filter((row) => (since ? String(row[CURSOR]) > since : true))
      .sort((a, b) => String(a[CURSOR]).localeCompare(String(b[CURSOR])));
    const rows = all.slice(0, limit);
    return {
      rows: rows.map((r) => ({ ...r })),
      cursor: rows.length > 0 ? String(rows[rows.length - 1][CURSOR]) : null,
    };
  }

  /** Test helper: what the server holds for a table, tombstones included. */
  rowsFor(table: SyncTable): Row[] {
    return [...this.tableRows(table).values()];
  }
}
