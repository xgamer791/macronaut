import { api } from '../../convex/_generated/api';
import { clean, ConvexCaller } from './convexCall';

export interface RecentFood {
  foodKey: string;
  name: string;
  imageUrl?: string;
  lastLoggedAt: string;
}

export interface FrequentFood {
  foodKey: string;
  name: string;
  imageUrl?: string;
  count: number;
}

export interface HistoryRepo {
  /** Record a logging event for recents/frequents ranking. */
  recordLog(foodKey: string, name: string, meal: string, imageUrl?: string): Promise<void>;
  recentFoods(limit?: number): Promise<RecentFood[]>;
  /** Ranked by actual logging frequency; optionally biased to a meal
   * category (foods commonly logged in that meal rank first). */
  frequentFoods(limit?: number, meal?: string): Promise<FrequentFood[]>;
  recordSearch(query: string): Promise<void>;
  recentSearches(limit?: number): Promise<string[]>;
  clearSearches(): Promise<void>;
}

export function createHistoryRepo(convex: ConvexCaller): HistoryRepo {
  return {
    async recordLog(foodKey, name, meal, imageUrl) {
      await convex.mutation(api.history.recordLog, clean({ foodKey, name, meal, imageUrl }));
    },
    recentFoods: (limit) => convex.query(api.history.recentFoods, clean({ limit })),
    frequentFoods: (limit, meal) => convex.query(api.history.frequentFoods, clean({ limit, meal })),
    async recordSearch(query) {
      if (!query.trim()) return;
      await convex.mutation(api.history.recordSearch, { query });
    },
    recentSearches: (limit) => convex.query(api.history.recentSearches, clean({ limit })),
    async clearSearches() {
      await convex.mutation(api.history.clearSearches, {});
    },
  };
}
