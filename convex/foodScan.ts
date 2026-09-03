import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { action, query } from './_generated/server';
import { internal } from './_generated/api';
import { requireUserId } from './lib/auth';
import { canUseAiFoodScan } from './lib/aiScanAccess';
import { analyzeFoodPhoto } from './lib/grokVision';

/** Whether this signed-in account may use AI food scan. Never returns the key. */
export const available = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return { allowed: canUseAiFoodScan(user?.email) };
  },
});

/** Photo → Grok vision using the shared xAI key on the Convex deployment.
 * The key is a server env var (`XAI_API_KEY`) and is never sent to the client. */
export const analyzePhoto = action({
  args: { dataUrl: v.string() },
  handler: async (ctx, { dataUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not signed in');

    const email = await ctx.runQuery(internal.account.viewerEmail, {});
    if (!canUseAiFoodScan(email)) {
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
