import { Database } from '@/db/driver';
import { newId, nowIso } from './util';

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

export function createHistoryRepo(db: Database): HistoryRepo {
  return {
    async recordLog(foodKey, name, meal, imageUrl) {
      await db.runAsync(
        'INSERT INTO food_log_history (id, food_key, name, meal, logged_at, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [newId(), foodKey, name, meal, nowIso(), imageUrl ?? null],
      );
    },

    async recentFoods(limit = 15) {
      return db.getAllAsync<RecentFood>(
        `SELECT food_key as foodKey, name, MAX(image_url) as imageUrl, MAX(logged_at) as lastLoggedAt
         FROM food_log_history GROUP BY food_key ORDER BY lastLoggedAt DESC LIMIT ?`,
        [limit],
      );
    },

    async frequentFoods(limit = 15, meal) {
      if (meal) {
        // Bias: rank by count within the meal first, then overall recency.
        return db.getAllAsync<FrequentFood>(
          `SELECT food_key as foodKey, name, MAX(image_url) as imageUrl,
             COUNT(*) as count,
             SUM(CASE WHEN meal = ? THEN 1 ELSE 0 END) as mealCount
           FROM food_log_history
           GROUP BY food_key
           HAVING count >= 1
           ORDER BY mealCount DESC, count DESC, MAX(logged_at) DESC
           LIMIT ?`,
          [meal, limit],
        );
      }
      return db.getAllAsync<FrequentFood>(
        `SELECT food_key as foodKey, name, MAX(image_url) as imageUrl, COUNT(*) as count
         FROM food_log_history GROUP BY food_key
         ORDER BY count DESC, MAX(logged_at) DESC LIMIT ?`,
        [limit],
      );
    },

    async recordSearch(query) {
      const q = query.trim();
      if (!q) return;
      await db.runAsync(
        `INSERT INTO search_history (query, searched_at) VALUES (?, ?)
         ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at`,
        [q, nowIso()],
      );
    },

    async recentSearches(limit = 10) {
      const rows = await db.getAllAsync<{ query: string }>(
        'SELECT query FROM search_history ORDER BY searched_at DESC LIMIT ?',
        [limit],
      );
      return rows.map((r) => r.query);
    },

    async clearSearches() {
      await db.runAsync('DELETE FROM search_history');
    },
  };
}
