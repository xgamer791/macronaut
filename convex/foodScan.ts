import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { canUseAiFoodScanByProfile } from './lib/aiScanAccess';
import { analyzeFoodPhoto } from './lib/grokVision';

const ROSTER_META_KEY = 'default';

async function rosterFrozen(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const meta = await ctx.db
    .query('aiScanRosterMeta')
    .withIndex('by_key', (q) => q.eq('key', ROSTER_META_KEY))
    .unique();
  return !!meta;
}

async function onRoster(ctx: QueryCtx | MutationCtx, userId: Id<'users'>): Promise<boolean> {
  const row = await ctx.db
    .query('aiScanRoster')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return !!row;
}

async function freezeRoster(ctx: MutationCtx): Promise<void> {
  if (await rosterFrozen(ctx)) return;
  const users = await ctx.db.query('users').collect();
  for (const user of users) {
    await ctx.db.insert('aiScanRoster', { userId: user._id });
  }
  await ctx.db.insert('aiScanRosterMeta', { key: ROSTER_META_KEY, frozenAt: nowIso() });
}

async function callerAllowed(ctx: QueryCtx | MutationCtx, userId: Id<'users'>): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (canUseAiFoodScanByProfile({ email: user?.email, name: user?.name })) return true;
  // Until the roster is frozen, every existing account is a "current user".
  if (!(await rosterFrozen(ctx))) return true;
  return onRoster(ctx, userId);
}

/** Snapshot every account that exists right now. Later sign-ups are not added.
 * Safe to call repeatedly — only the first call writes. */
export const ensureRoster = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    await freezeRoster(ctx);
    return { frozen: true as const };
  },
});

export const ensureRosterInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    await freezeRoster(ctx);
    return { frozen: true as const };
  },
});

export const evaluateAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return { allowed: await callerAllowed(ctx, userId) };
  },
});

/** Whether this signed-in account may use AI food scan. Never returns the key. */
export const available = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return { allowed: await callerAllowed(ctx, userId) };
  },
});

/** Photo → Grok vision using the shared xAI key on the Convex server.
 * The key is `XAI_API_KEY` on the deployment and never reaches the client. */
export const analyzePhoto = action({
  args: { dataUrl: v.string() },
  handler: async (ctx, { dataUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not signed in');

    await ctx.runMutation(internal.foodScan.ensureRosterInternal, {});
    const access = await ctx.runQuery(internal.foodScan.evaluateAccess, {});
    if (!access.allowed) {
      throw new ConvexError('AI food scan is a Pro feature');
    }

    if (!dataUrl.startsWith('data:image/')) {
      throw new ConvexError('Please choose a JPEG or PNG photo');
    }

    const key = (process.env.XAI_API_KEY ?? '').trim();
    if (!key) throw new ConvexError('AI food scan is not configured');

    try {
      return await analyzeFoodPhoto({ apiKey: key, dataUrl });
    } catch (e) {
      throw new ConvexError(e instanceof Error ? e.message : 'AI scan failed');
    }
  },
});
