import { Nutrition } from '@/domain/types';
import { ProviderFood } from './types';

/** Built-in generic foods (USDA Standard Reference–derived, per 100 g).
 * These are bundled with the app so common meats, seafood and staples ALWAYS
 * appear in search — instantly, offline, and regardless of provider rate
 * limits. Values are per 100 g; portions recalculate by weight. Every entry
 * is user-editable at log time via Edit nutrition. */

interface GenericEntry {
  id: string;
  name: string;
  aliases: string[];
  n: Nutrition; // per 100 g
}

const g = (
  id: string,
  name: string,
  aliases: string[],
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  extra: Partial<Nutrition> = {},
): GenericEntry => ({ id, name, aliases, n: { calories, protein, carbs, fat, ...extra } });

export const GENERIC_FOODS: GenericEntry[] = [
  // Chicken
  g('chicken-breast-raw', 'Chicken breast, skinless, raw', ['chicken breast', 'chicken'], 120, 22.5, 0, 2.6, { sodium: 45, cholesterol: 73 }),
  g('chicken-breast-cooked', 'Chicken breast, skinless, cooked', ['chicken breast cooked', 'grilled chicken', 'chicken'], 165, 31, 0, 3.6, { sodium: 74, cholesterol: 85 }),
  g('chicken-tenderloin-raw', 'Chicken tenderloin, raw', ['chicken tender', 'chicken tenders', 'chicken tenderloin'], 109, 22.3, 0, 1.9, { sodium: 51, cholesterol: 62 }),
  g('chicken-thigh-raw', 'Chicken thigh, skinless, raw', ['chicken thigh', 'chicken thighs'], 121, 19.7, 0, 4.1, { sodium: 86, cholesterol: 94 }),
  g('chicken-thigh-cooked', 'Chicken thigh, skinless, cooked', ['chicken thigh cooked', 'chicken thighs'], 179, 24.8, 0, 8.2, { sodium: 88, cholesterol: 133 }),
  g('chicken-drumstick', 'Chicken drumstick, skinless, cooked', ['chicken drumstick', 'drumstick', 'chicken leg'], 155, 24.2, 0, 5.7, { sodium: 96, cholesterol: 128 }),
  g('chicken-wing', 'Chicken wing, with skin, cooked', ['chicken wing', 'chicken wings', 'wings'], 254, 23.4, 0, 17, { sodium: 82, cholesterol: 84 }),
  g('ground-chicken', 'Ground chicken, cooked', ['ground chicken'], 189, 23.3, 0, 10.2, { sodium: 75, cholesterol: 107 }),
  // Turkey
  g('turkey-breast', 'Turkey breast, skinless, roasted', ['turkey breast', 'turkey'], 147, 30.1, 0, 2.1, { sodium: 99, cholesterol: 77 }),
  g('ground-turkey-93', 'Ground turkey, 93% lean, raw', ['ground turkey', 'ground turkey 93'], 150, 18.7, 0, 8.3, { sodium: 69, cholesterol: 74 }),
  // Beef
  g('ground-beef-96', 'Ground beef, 96% lean, raw', ['ground beef 96', 'extra lean ground beef', 'lean ground beef'], 136, 21.4, 0, 4.8, { sodium: 66, cholesterol: 62 }),
  g('ground-beef-90', 'Ground beef, 90% lean, raw', ['ground beef 90', 'lean ground beef', 'ground beef'], 176, 20, 0, 10, { sodium: 66, cholesterol: 65 }),
  g('ground-beef-85', 'Ground beef, 85% lean, raw', ['ground beef 85', 'ground beef'], 215, 18.6, 0, 15, { sodium: 66, cholesterol: 68 }),
  g('ground-beef-80', 'Ground beef, 80% lean, raw', ['ground beef 80', 'ground beef'], 254, 17.2, 0, 20, { sodium: 66, cholesterol: 71 }),
  g('sirloin-steak', 'Sirloin steak, lean, cooked', ['sirloin', 'sirloin steak', 'steak'], 183, 27, 0, 7.6, { sodium: 56, cholesterol: 76 }),
  g('ribeye-steak', 'Ribeye steak, cooked', ['ribeye', 'rib eye', 'steak'], 291, 24, 0, 21.8, { sodium: 54, cholesterol: 80 }),
  g('ny-strip-steak', 'New York strip steak, cooked', ['new york strip', 'ny strip', 'strip steak', 'steak'], 224, 29, 0, 11.7, { sodium: 58, cholesterol: 82 }),
  g('filet-mignon', 'Filet mignon (tenderloin), lean, cooked', ['filet mignon', 'beef tenderloin', 'filet'], 188, 28.5, 0, 7.5, { sodium: 57, cholesterol: 84 }),
  g('flank-steak', 'Flank steak, cooked', ['flank steak', 'flank'], 192, 27.5, 0, 8.2, { sodium: 56, cholesterol: 77 }),
  g('skirt-steak', 'Skirt steak, cooked', ['skirt steak', 'skirt'], 220, 26.7, 0, 12, { sodium: 79, cholesterol: 84 }),
  g('chuck-roast', 'Chuck roast, lean, cooked', ['chuck roast', 'pot roast', 'chuck'], 219, 29.4, 0, 10.5, { sodium: 66, cholesterol: 98 }),
  // Pork
  g('pork-chop', 'Pork chop, lean, cooked', ['pork chop', 'pork chops'], 184, 26.2, 0, 8, { sodium: 58, cholesterol: 78 }),
  g('pork-tenderloin', 'Pork tenderloin, cooked', ['pork tenderloin'], 143, 26, 0, 3.5, { sodium: 57, cholesterol: 80 }),
  g('ground-pork', 'Ground pork, cooked', ['ground pork'], 297, 25.7, 0, 20.8, { sodium: 73, cholesterol: 94 }),
  g('ham', 'Ham, sliced, lean', ['ham', 'deli ham'], 107, 16.6, 1.1, 3.7, { sodium: 1200, cholesterol: 46 }),
  g('bacon', 'Bacon, cooked', ['bacon'], 541, 37, 1.4, 42, { sodium: 1717, cholesterol: 110 }),
  // Seafood
  g('salmon', 'Salmon, Atlantic, cooked', ['salmon'], 206, 22.1, 0, 12.4, { sodium: 61, cholesterol: 63 }),
  g('tuna', 'Tuna, yellowfin, cooked', ['tuna', 'tuna steak'], 130, 28, 0, 0.6, { sodium: 50, cholesterol: 47 }),
  g('tuna-canned', 'Tuna, canned in water, drained', ['canned tuna', 'tuna can'], 116, 25.5, 0, 0.8, { sodium: 247, cholesterol: 42 }),
  g('shrimp', 'Shrimp, cooked', ['shrimp', 'prawns'], 99, 24, 0.2, 0.3, { sodium: 111, cholesterol: 189 }),
  g('tilapia', 'Tilapia, cooked', ['tilapia'], 128, 26.2, 0, 2.7, { sodium: 56, cholesterol: 57 }),
  g('cod', 'Cod, cooked', ['cod'], 105, 22.8, 0, 0.9, { sodium: 78, cholesterol: 55 }),
  // Staples
  g('egg-whole', 'Egg, whole, raw', ['egg', 'eggs', 'whole egg'], 143, 12.6, 0.7, 9.5, { sodium: 142, cholesterol: 372 }),
  g('egg-whites', 'Egg whites', ['egg white', 'egg whites', 'liquid egg whites'], 52, 10.9, 0.7, 0.2, { sodium: 166, cholesterol: 0 }),
  g('white-rice', 'White rice, cooked', ['white rice', 'rice'], 130, 2.7, 28.2, 0.3, { fiber: 0.4, sodium: 1 }),
  g('brown-rice', 'Brown rice, cooked', ['brown rice', 'rice'], 123, 2.7, 25.6, 1, { fiber: 1.6, sodium: 4 }),
  g('oats', 'Oats, dry', ['oats', 'oatmeal', 'rolled oats'], 379, 13.2, 67.7, 6.5, { fiber: 10.1, sugar: 1, sodium: 6 }),
  g('potato', 'Potato, baked, with skin', ['potato', 'baked potato'], 93, 2.5, 21.1, 0.1, { fiber: 2.2, sodium: 10 }),
  g('sweet-potato', 'Sweet potato, baked', ['sweet potato'], 90, 2, 20.7, 0.2, { fiber: 3.3, sugar: 6.5, sodium: 36 }),
];

function toProviderFood(e: GenericEntry): ProviderFood {
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
export function genericMatchScore(query: string, entry: GenericEntry): number {
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
  const nameWords = new Set(name.split(' ').concat(entry.aliases.flatMap((a) => norm(a).split(' '))));
  const hits = qWords.filter((w) => nameWords.has(w)).length;
  if (hits === qWords.length) return 40 + Math.min(hits, 5);
  if (hits > 0 && hits >= qWords.length - 1 && qWords.length > 1) return 20;
  return 0;
}

/** Search the bundled dataset. Always instant and offline. */
export function searchGenericFoods(query: string, limit = 8): ProviderFood[] {
  const scored = GENERIC_FOODS.map((e) => ({ e, score: genericMatchScore(query, e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => toProviderFood(x.e));
}

export function getGenericFood(id: string): ProviderFood | null {
  const e = GENERIC_FOODS.find((x) => x.id === id);
  return e ? toProviderFood(e) : null;
}
