import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn } from './helpers';

const estimate = {
  name: 'Grilled chicken breast',
  brand: null,
  servingQty: 180,
  servingUnit: 'g',
  gramsPerServing: 180,
  calories: 297,
  protein: 55,
  carbs: 0,
  fat: 6.5,
  fiber: 0,
  confidence: 0.82,
  notes: 'Skinless',
};

describe('AI food scan access', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.XAI_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
  });

  it('refuses every call without a session', async () => {
    const t = backend();
    await expect(t.query(api.foodScan.available, {})).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.foodScan.ensureRoster, {})).rejects.toThrow(/not signed in/i);
    await expect(
      t.action(api.foodScan.analyzePhoto, { dataUrl: 'data:image/jpeg;base64,abc' }),
    ).rejects.toThrow(/not signed in/i);
  });

  it('grandfathers accounts that exist when the roster freezes, and blocks later sign-ups', async () => {
    const t = backend();
    const current = await signIn(t, 'current@example.com');
    await current.repos.food.ensureAiScanRoster();
    expect(await current.repos.food.aiScanAvailable()).toBe(true);

    const newbie = await signIn(t, 'newbie@example.com');
    expect(await newbie.repos.food.aiScanAvailable()).toBe(false);
    await expect(
      newbie.repos.food.analyzeFoodPhoto('data:image/jpeg;base64,abc'),
    ).rejects.toThrow(/pro feature/i);
  });

  it('lets Holly Ky through by name even if she was not on the frozen roster', async () => {
    process.env.XAI_API_KEY = 'xai-test-server-key';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(estimate) }),
    })) as unknown as typeof fetch;

    const t = backend();
    const owner = await signIn(t, 'lifewirecg@gmail.com');
    await owner.repos.food.ensureAiScanRoster();

    const holly = await signIn(t, 'holly@example.com');
    await t.run(async (ctx) => {
      await ctx.db.patch(holly.userId, { name: 'Holly Ky' });
    });
    expect(await holly.repos.food.aiScanAvailable()).toBe(true);
    await expect(holly.repos.food.analyzeFoodPhoto('data:image/jpeg;base64,abc')).resolves.toMatchObject({
      name: 'Grilled chicken breast',
    });
  });

  it('lets the allow-listed accounts scan, using the server key only', async () => {
    process.env.XAI_API_KEY = 'xai-test-server-key';
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      expect(auth).toBe('Bearer xai-test-server-key');
      return {
        ok: true,
        json: async () => ({ output_text: JSON.stringify(estimate) }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const t = backend();
    const owner = await signIn(t, 'lifewirecg@gmail.com');
    expect(await owner.repos.food.aiScanAvailable()).toBe(true);

    const result = await owner.repos.food.analyzeFoodPhoto('data:image/jpeg;base64,abc');
    expect(result.name).toBe('Grilled chicken breast');
    expect(result.nutrition.calories).toBe(297);
    expect(JSON.stringify(result)).not.toMatch(/xai-test-server-key/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an allow-listed account when the server key is missing', async () => {
    delete process.env.XAI_API_KEY;
    const t = backend();
    const owner = await signIn(t, 'lifewirecg@gmail.com');
    await expect(owner.repos.food.analyzeFoodPhoto('data:image/jpeg;base64,abc')).rejects.toThrow(
      /not configured/i,
    );
  });

  it('lets the partner account through as well', async () => {
    process.env.XAI_API_KEY = 'xai-test-server-key';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(estimate) }),
    })) as unknown as typeof fetch;

    const t = backend();
    const partner = await signIn(t, 'salonnewvine@gmail.com');
    expect(await partner.repos.food.aiScanAvailable()).toBe(true);
    await expect(partner.repos.food.analyzeFoodPhoto('data:image/jpeg;base64,abc')).resolves.toMatchObject({
      name: 'Grilled chicken breast',
    });
  });

  it('never returns the key from public functions', async () => {
    process.env.XAI_API_KEY = 'xai-must-never-leak';
    const t = backend();
    const owner = await signIn(t, 'lifewirecg@gmail.com');
    const available = await owner.as.query(api.foodScan.available, {});
    expect(available).toEqual({ allowed: true });
    expect(JSON.stringify(available)).not.toMatch(/xai-must-never-leak/);
  });
});
