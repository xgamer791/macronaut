import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { Doc, Id, TableNames } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** The signed-in user, or a thrown error. Every function that touches user
 * data starts here: the id comes from the verified session, never from the
 * client, so a caller cannot address another account's rows. */
export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Not signed in');
  return userId;
}

type OwnedTable = {
  [T in TableNames]: Doc<T> extends { userId: Id<'users'> } ? T : never;
}[TableNames];

/** Load a document by id and refuse it unless the signed-in user owns it.
 * Returns null for a missing document so callers can decide between "not
 * found" and "forbidden" being the same answer (they are, to the client). */
export async function getOwned<T extends OwnedTable>(
  ctx: QueryCtx | MutationCtx,
  table: T,
  id: Id<T>,
  userId: Id<'users'>,
): Promise<Doc<T> | null> {
  const doc = await ctx.db.get(id);
  if (!doc) return null;
  const owner = (doc as unknown as { userId: Id<'users'> }).userId;
  if (owner !== userId) return null;
  // `db.get` cannot narrow to the table from a generic Id at the type level.
  void table;
  return doc as unknown as Doc<T>;
}

export async function requireOwned<T extends OwnedTable>(
  ctx: QueryCtx | MutationCtx,
  table: T,
  id: Id<T>,
  userId: Id<'users'>,
): Promise<Doc<T>> {
  const doc = await getOwned(ctx, table, id, userId);
  if (!doc) throw new ConvexError(`Not found: ${table}`);
  return doc;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Strip Convex system fields and ownership before handing a row to the
 * client, exposing `_id` as the app's `id`. */
export function publicDoc<T extends { _id: Id<TableNames>; _creationTime: number; userId: Id<'users'> }>(
  doc: T,
): Omit<T, '_id' | '_creationTime' | 'userId'> & { id: string } {
  const { _id, _creationTime: _t, userId: _u, ...rest } = doc;
  return { ...rest, id: _id };
}
