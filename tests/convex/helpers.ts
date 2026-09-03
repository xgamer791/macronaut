/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { createRepos, type Repos } from '../../src/state/AppProvider';
import type { ConvexCaller } from '../../src/repositories/convexCall';

/** Every module Convex would bundle (convex-test locates the functions root
 * from the `_generated` entries), so `api.*` references resolve. */
export const modules = import.meta.glob('../../convex/**/*.*s');

export function backend() {
  return convexTest(schema, modules);
}

export type Backend = ReturnType<typeof backend>;

/** A signed-in user. Convex Auth encodes `userId|sessionId` in the JWT
 * subject, which is all `getAuthUserId` reads. */
export async function signIn(t: Backend, email = 'person@example.com') {
  const userId = await t.run(async (ctx) => ctx.db.insert('users', { email }));
  const sessionId = await t.run(async (ctx) =>
    ctx.db.insert('authSessions', { userId, expirationTime: Date.now() + 86_400_000 }),
  );
  const as = t.withIdentity({ subject: `${userId}|${sessionId}` });
  const caller = {
    query: (fn: unknown, args: unknown) => (as.query as Function)(fn, args),
    mutation: (fn: unknown, args: unknown) => (as.mutation as Function)(fn, args),
    action: (fn: unknown, args: unknown) => (as.action as Function)(fn, args),
  } as unknown as ConvexCaller;
  return { userId: userId as Id<'users'>, sessionId, as, repos: createRepos(caller) };
}

export async function signedInRepos(t: Backend, email?: string): Promise<Repos> {
  return (await signIn(t, email)).repos;
}

/** Timestamps are millisecond ISO strings; two writes in the same millisecond
 * tie. Tests that assert recency order wait one tick between writes. */
export async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2));
}
