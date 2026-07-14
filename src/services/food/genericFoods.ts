import { ProviderFood } from './types';
import { GENERIC_FOOD_SOURCE, VERIFIED_GENERIC_FOODS, VerifiedGenericFood } from './genericFoods.data';

/** Built-in generic whole foods — every entry is verbatim USDA SR Legacy
 * data (see genericFoods.data.ts for source records and attribution).
 * Bundled with the app: instant, offline, immune to provider rate limits,
 * always weight-based (per 100 g) so portions recalculate from the exact
 * source profile, never from rounded display values. */

export { GENERIC_FOOD_SOURCE };
export type { VerifiedGenericFood };

function toProviderFood(e: VerifiedGenericFood): ProviderFood {
  return {
    provider: 'local',
    id: e.id,
    name: e.name,
    isGeneric: true,
    nutritionPer100g: e.n,
    nutritionPerServing: e.n,
    gramsPerServing: 100,
    servingLabel: '100 g',
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 %]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Match score: 0 = no match. Higher = better. */
export function genericMatchScore(query: string, entry: VerifiedGenericFood): number {
  const q = norm(query);
  if (!q) return 0;
  const name = norm(entry.name);
  if (name === q) return 100;
  for (const alias of entry.aliases) {
    const a = norm(alias);
    if (a === q) return 90;
    if (a.startsWith(q) && q.length >= 4) return 70;
  }
  if (name.startsWith(q)) return 60;
  const qWords = q.split(' ');
  const nameWords = new Set(
    name.split(' ').concat(entry.aliases.flatMap((a) => norm(a).split(' '))),
  );
  const hits = qWords.filter((w) => nameWords.has(w)).length;
  if (hits === qWords.length) return 40 + Math.min(hits, 5);
  if (hits > 0 && hits >= qWords.length - 1 && qWords.length > 1) return 20;
  return 0;
}

/** Search the bundled verified dataset. Always instant and offline. Raw
 * preparations rank ahead of cooked at equal match score (users usually
 * weigh raw), otherwise score order. */
export function searchGenericFoods(query: string, limit = 10): ProviderFood[] {
  const scored = VERIFIED_GENERIC_FOODS.map((e) => ({ e, score: genericMatchScore(query, e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, limit);
  return scored.map((x) => toProviderFood(x.e));
}

export function getGenericFood(id: string): ProviderFood | null {
  const e = VERIFIED_GENERIC_FOODS.find((x) => x.id === id);
  return e ? toProviderFood(e) : null;
}

/** Full source record (attribution, prep state, FDC id) for a generic id. */
export function getGenericFoodRecord(id: string): VerifiedGenericFood | null {
  return VERIFIED_GENERIC_FOODS.find((x) => x.id === id) ?? null;
}
