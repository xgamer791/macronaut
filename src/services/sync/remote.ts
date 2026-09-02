import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncTable } from './tables';

export type Row = Record<string, unknown>;

export interface PullPage {
  rows: Row[];
  /** Cursor to resume from, or null when the table is fully drained. */
  cursor: string | null;
}

/** What the sync engine needs from the server. Kept narrow and free of
 * Supabase types so the engine can be driven by an in-memory fake in tests. */
export interface RemoteStore {
  upsert(table: SyncTable, rows: Row[]): Promise<void>;
  /** Write tombstones so other devices learn about the deletion. */
  remove(table: SyncTable, keys: Row[]): Promise<void>;
  pull(table: SyncTable, since: string | null, limit: number): Promise<PullPage>;
}

/** Server columns that carry sync bookkeeping rather than user data. */
export const DELETED = '_deleted';
export const CURSOR = '_synced_at';

/** Supabase-backed store. Every call is scoped to the caller's rows by Row
 * Level Security, so no filter here is load-bearing for security — the
 * user_id filter on pull is there to help the index, not to protect data. */
export class SupabaseRemote implements RemoteStore {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string,
  ) {}

  async upsert(table: SyncTable, rows: Row[]): Promise<void> {
    if (rows.length === 0) return;
    const payload = rows.map((row) => ({
      ...row,
      user_id: this.userId,
      [DELETED]: false,
    }));
    const { error } = await this.supabase
      .from(table.name)
      .upsert(payload, { onConflict: ['user_id', ...table.pk].join(',') });
    if (error) throw new Error(`push ${table.name}: ${error.message}`);
  }

  async remove(table: SyncTable, keys: Row[]): Promise<void> {
    if (keys.length === 0) return;
    // A tombstone, not a DELETE: a row removed here must stay visible to the
    // user's other devices long enough for them to remove it too.
    const payload = keys.map((key) => ({
      ...key,
      user_id: this.userId,
      [DELETED]: true,
    }));
    const { error } = await this.supabase
      .from(table.name)
      .upsert(payload, { onConflict: ['user_id', ...table.pk].join(',') });
    if (error) throw new Error(`delete ${table.name}: ${error.message}`);
  }

  async pull(table: SyncTable, since: string | null, limit: number): Promise<PullPage> {
    let query = this.supabase
      .from(table.name)
      .select('*')
      .eq('user_id', this.userId)
      .order(CURSOR, { ascending: true })
      .limit(limit);
    if (since) query = query.gt(CURSOR, since);

    const { data, error } = await query;
    if (error) throw new Error(`pull ${table.name}: ${error.message}`);

    const rows = (data ?? []) as Row[];
    // Only advance the cursor on a full page; a partial page means we reached
    // the end, and the caller keeps the last row's stamp either way.
    const last = rows.length > 0 ? String(rows[rows.length - 1][CURSOR]) : null;
    return { rows, cursor: last };
  }
}
