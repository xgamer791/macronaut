import { ProviderFood } from './types';
import {
  RESTAURANT_FOODS,
  RESTAURANT_FOOD_SOURCE,
  RestaurantFoodRecord,
} from './restaurantFoods.data';

export { RESTAURANT_FOOD_SOURCE };
export type { RestaurantFoodRecord };

function toProviderFood(e: RestaurantFoodRecord): ProviderFood {
  const nutrition = {
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    saturatedFat: e.saturatedFat,
    fiber: e.fiber,
    sugar: e.sugar,
    sodium: e.sodium,
  };
  return {
    provider: 'restaurant',
    id: e.id,
    name: `${e.restaurant} ${e.menuItem}`,
    restaurant: e.restaurant,
    isGeneric: false,
    nutritionPerServing: nutrition,
    gramsPerServing: e.servingWeightGrams,
    servingLabel: e.servingSize,
    verified: true,
    lastVerified: e.dateVerified,
    category: 'restaurant',
    confidence: 0.92,
    confidenceLevel: 'high',
  };
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 %&'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match score: 0 = no match. Higher = better. */
export function restaurantMatchScore(query: string, entry: RestaurantFoodRecord): number {
  const q = norm(query);
  if (!q) return 0;
  const restaurant = norm(entry.restaurant);
  const item = norm(entry.menuItem);
  const full = `${restaurant} ${item}`;
  const aliases = (entry.aliases ?? []).map(norm);

  if (full === q || item === q) return 100;
  if (aliases.some((a) => a === q)) return 95;

  // "chipotle chicken" / "mcdonalds big mac"
  if (q.includes(restaurant) && (item.includes(q.replace(restaurant, '').trim()) || aliases.some((a) => q.includes(a)))) {
    return 85;
  }
  if (q.includes(restaurant) && item.split(' ').some((w) => w.length > 2 && q.includes(w))) {
    return 70;
  }

  for (const a of aliases) {
    if (a.length >= 3 && (q.includes(a) || a.includes(q))) return 65;
  }
  if (item.startsWith(q) && q.length >= 3) return 55;
  if (restaurant.startsWith(q) && q.length >= 3) return 50;
  if (full.includes(q) && q.length >= 3) return 40;

  const qWords = q.split(' ').filter((w) => w.length > 1);
  const corpus = new Set(
    full.split(' ').concat(aliases.flatMap((a) => a.split(' ')), restaurant.split(' ')),
  );
  const hits = qWords.filter((w) => corpus.has(w) || [...corpus].some((c) => c.includes(w))).length;
  if (hits === qWords.length && qWords.length > 0) return 35 + Math.min(hits, 5);
  if (hits >= Math.ceil(qWords.length * 0.6) && hits >= 2) return 20;
  return 0;
}

/** Search bundled official restaurant nutrition. Instant, offline, verified. */
export function searchRestaurantFoods(query: string, limit = 15): ProviderFood[] {
  const scored = RESTAURANT_FOODS.map((e) => ({ e, score: restaurantMatchScore(query, e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.menuItem.localeCompare(b.e.menuItem))
    .slice(0, limit);
  return scored.map((x) => toProviderFood(x.e));
}

export function getRestaurantFood(id: string): ProviderFood | null {
  const e = RESTAURANT_FOODS.find((x) => x.id === id);
  return e ? toProviderFood(e) : null;
}

export function listRestaurants(): string[] {
  return [...new Set(RESTAURANT_FOODS.map((e) => e.restaurant))].sort();
}
