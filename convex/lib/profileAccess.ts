import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { normalizeHandle } from './handles';

/** A profile the caller is allowed to look at. Private pages and missing
 * handles are the same answer (`null`), matching `profiles.byHandle`. */
export async function readableProfile(
  ctx: QueryCtx,
  handle: string,
): Promise<{
  row: Doc<'profiles'>;
  viewerId: Id<'users'> | null;
  isOwner: boolean;
} | null> {
  const wanted = normalizeHandle(handle);
  if (!wanted) return null;
  const row = await ctx.db
    .query('profiles')
    .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
    .first();
  if (!row) return null;
  const viewerId = await getAuthUserId(ctx);
  const isOwner = viewerId === row.userId;
  if (!row.isPublic && !isOwner) return null;
  return { row, viewerId, isOwner };
}
