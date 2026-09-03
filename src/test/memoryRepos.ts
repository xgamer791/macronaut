/** In-memory repositories for the Jest suites that exercise services on top
 * of the repository interfaces (food engine, demo seed).
 * Persistence itself is covered by tests/convex, which runs the real Convex
 * functions; these fakes only need the interface contract. */
import { sumNutrition, scaleNutrition } from '@/domain/nutrition';
import { AccountRepo } from '@/repositories/accountRepo';
import { DayType, DayTypeMarks, GoalConfig, configForDate } from '@/domain/goals';
import { Nutrition, UnitSystem, WeekStart } from '@/domain/types';
import { ActivityRepo, NewActivityEntry } from '@/repositories/activityRepo';
import {
  CollectionInput,
  CollectionRepo,
  RecipeRepo,
  SavedMealRepo,
} from '@/repositories/collectionsRepo';
import { DayNote, DayNotesRepo } from '@/repositories/dayNotesRepo';
import { DiaryRepo, NewDiaryEntry } from '@/repositories/diaryRepo';
import { FoodRepo, NewCustomFood } from '@/repositories/foodRepo';
import { GoalRepo } from '@/repositories/goalRepo';
import { FrequentFood, HistoryRepo, RecentFood } from '@/repositories/historyRepo';
import { AppearanceMode, OnboardingProfile, SettingsRepo } from '@/repositories/settingsRepo';
import {
  ActivityEntry,
  CachedFood,
  CustomFood,
  DiaryEntry,
  MealCategory,
  Recipe,
  SavedMeal,
} from '@/repositories/types';
import { Repos } from '@/state/AppProvider';
import { DayKey } from '@/utils/date';

let counter = 0;
const newId = () => `mem-${(counter += 1)}`;
const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createMemorySettingsRepo(): SettingsRepo {
  const store = new Map<string, string>();
  const customMeals: MealCategory[] = [];
  const builtins: MealCategory[] = [
    { id: 'breakfast', name: 'Breakfast', position: 0, builtin: true },
    { id: 'lunch', name: 'Lunch', position: 1, builtin: true },
    { id: 'dinner', name: 'Dinner', position: 2, builtin: true },
    { id: 'snacks', name: 'Snacks', position: 3, builtin: true },
  ];
  async function get<T>(key: string, fallback: T): Promise<T> {
    const raw = store.get(key);
    return raw === undefined ? fallback : (JSON.parse(raw) as T);
  }
  async function set<T>(key: string, value: T): Promise<void> {
    store.set(key, JSON.stringify(value));
  }
  return {
    get,
    set,
    getOnboardingComplete: () => get('onboardingComplete', false),
    setOnboardingComplete: (complete) => set('onboardingComplete', complete),
    getProfile: () => get<OnboardingProfile>('profile', {}),
    setProfile: (profile) => set('profile', profile),
    getUnitSystem: () => get<UnitSystem>('unitSystem', 'us'),
    setUnitSystem: (units) => set('unitSystem', units),
    getWeekStart: () => get<WeekStart>('weekStart', 'monday'),
    setWeekStart: (start) => set('weekStart', start),
    getAppearance: () => get<AppearanceMode>('appearance', 'system'),
    setAppearance: (mode) => set('appearance', mode),
    async getMealCategories() {
      return [...builtins, ...customMeals].sort((a, b) => a.position - b.position);
    },
    async addMealCategory(name) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Meal name is required');
      const position = Math.max(3, ...customMeals.map((c) => c.position)) + 1;
      const cat: MealCategory = {
        id: `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${position}`,
        name: trimmed,
        position,
        builtin: false,
      };
      customMeals.push(cat);
      return cat;
    },
  };
}

export function createMemoryGoalRepo(): GoalRepo {
  let configs: GoalConfig[] = [];
  const marks: DayTypeMarks = {};
  const listConfigs = async () =>
    [...configs].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).map(clone);
  return {
    listConfigs,
    async saveConfig(config) {
      const full: GoalConfig = { ...clone(config), id: newId() };
      configs = configs.filter((c) => c.effectiveFrom !== full.effectiveFrom);
      configs.push(full);
      return clone(full);
    },
    async configFor(date) {
      return configForDate(date, await listConfigs());
    },
    async getMarks(from, to) {
      const out: DayTypeMarks = {};
      for (const [date, type] of Object.entries(marks)) {
        if (date >= from && date <= to) out[date] = type;
      }
      return out;
    },
    async allMarks() {
      return { ...marks };
    },
    async setMark(date: DayKey, type: DayType | null) {
      if (type === null) delete marks[date];
      else marks[date] = type;
    },
  };
}

export function createMemoryDiaryRepo(): DiaryRepo {
  const rows: DiaryEntry[] = [];
  const byId = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Diary entry not found: ${id}`);
    return row;
  };
  async function insert(entry: NewDiaryEntry): Promise<DiaryEntry> {
    const now = nowIso();
    const full: DiaryEntry = { ...clone(entry), id: newId(), createdAt: now, updatedAt: now };
    rows.push(full);
    return clone(full);
  }
  const strip = (e: DiaryEntry): NewDiaryEntry => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = e;
    return rest;
  };
  const repo: DiaryRepo = {
    async entriesForDate(date) {
      return rows.filter((r) => r.date === date).map(clone);
    },
    async entriesForRange(from, to) {
      return rows
        .filter((r) => r.date >= from && r.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(clone);
    },
    add: insert,
    async update(id, patch) {
      const row = byId(id);
      Object.assign(row, clone(patch), { id, updatedAt: nowIso() });
      return clone(row);
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async removeMany(ids) {
      for (const id of ids) await repo.remove(id);
    },
    async duplicate(id) {
      return insert(strip(byId(id)));
    },
    async move(id, meal, date) {
      return repo.update(id, { meal, date: date ?? byId(id).date });
    },
    async moveMany(ids, meal, date) {
      for (const id of ids) await repo.move(id, meal, date);
    },
    async copyMeal(fromDate, meal, toDate) {
      const source = rows.filter((r) => r.date === fromDate && r.meal === meal);
      for (const r of source) await insert({ ...strip(r), date: toDate });
      return source.length;
    },
    async copyDay(fromDate, toDate) {
      const source = rows.filter((r) => r.date === fromDate);
      for (const r of source) await insert({ ...strip(r), date: toDate });
      return source.length;
    },
    async clearMeal(date, meal) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i].date === date && rows[i].meal === meal) rows.splice(i, 1);
      }
      return before - rows.length;
    },
  };
  return repo;
}

export function createMemoryActivityRepo(): ActivityRepo {
  const rows: ActivityEntry[] = [];
  const byId = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Activity entry not found: ${id}`);
    return row;
  };
  return {
    async entriesForDate(date) {
      return rows.filter((r) => r.date === date).map(clone);
    },
    async entriesForRange(from, to) {
      return rows
        .filter((r) => r.date >= from && r.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(clone);
    },
    async get(id) {
      const row = rows.find((r) => r.id === id);
      return row ? clone(row) : null;
    },
    async add(entry: NewActivityEntry) {
      const now = nowIso();
      const full: ActivityEntry = { ...clone(entry), id: newId(), createdAt: now, updatedAt: now };
      rows.push(full);
      return clone(full);
    },
    async update(id, patch) {
      const row = byId(id);
      Object.assign(row, clone(patch), { id, updatedAt: nowIso() });
      return clone(row);
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async previousByName(name, beforeDate, limit = 5) {
      return rows
        .filter((r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.date < beforeDate)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },
    async totalBurnedForDate(date) {
      return rows.filter((r) => r.date === date).reduce((sum, r) => sum + r.caloriesBurned, 0);
    },
  };
}

export function createMemoryDayNotesRepo(): DayNotesRepo {
  const rows: DayNote[] = [];
  return {
    async listForDate(date) {
      return rows.filter((r) => r.date === date).map(clone);
    },
    async add(date, body) {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note cannot be empty');
      const ts = nowIso();
      const note: DayNote = { id: newId(), date, body: trimmed, createdAt: ts, updatedAt: ts };
      rows.push(note);
      return clone(note);
    },
    async update(id, body) {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note cannot be empty');
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error('Note not found');
      row.body = trimmed;
      row.updatedAt = nowIso();
      return clone(row);
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async datesWithNotes(from, to) {
      const dates = new Set<string>();
      for (const r of rows) if (r.date >= from && r.date <= to && r.body.trim()) dates.add(r.date);
      return [...dates].sort();
    },
  };
}

export function createMemoryHistoryRepo(): HistoryRepo {
  const logs: { foodKey: string; name: string; meal: string; imageUrl?: string; loggedAt: string }[] = [];
  const searches = new Map<string, string>();
  return {
    async recordLog(foodKey, name, meal, imageUrl) {
      logs.push({ foodKey, name, meal, imageUrl, loggedAt: nowIso() });
    },
    async recentFoods(limit = 15) {
      const byKey = new Map<string, RecentFood>();
      for (const log of [...logs].reverse()) {
        if (!byKey.has(log.foodKey)) {
          byKey.set(log.foodKey, {
            foodKey: log.foodKey,
            name: log.name,
            imageUrl: log.imageUrl,
            lastLoggedAt: log.loggedAt,
          });
        }
      }
      return [...byKey.values()].slice(0, limit);
    },
    async frequentFoods(limit = 15, meal) {
      const byKey = new Map<string, FrequentFood & { mealCount: number; last: string }>();
      for (const log of logs) {
        const cur = byKey.get(log.foodKey);
        if (!cur) {
          byKey.set(log.foodKey, {
            foodKey: log.foodKey,
            name: log.name,
            imageUrl: log.imageUrl,
            count: 1,
            mealCount: meal && log.meal === meal ? 1 : 0,
            last: log.loggedAt,
          });
        } else {
          cur.count += 1;
          if (meal && log.meal === meal) cur.mealCount += 1;
          cur.last = log.loggedAt;
        }
      }
      return [...byKey.values()]
        .sort(
          (a, b) =>
            (meal ? b.mealCount - a.mealCount : 0) || b.count - a.count || b.last.localeCompare(a.last),
        )
        .slice(0, limit)
        .map(({ foodKey, name, imageUrl, count }) => ({ foodKey, name, imageUrl, count }));
    },
    async recordSearch(query) {
      const q = query.trim();
      if (q) searches.set(q, nowIso() + String((counter += 1)).padStart(6, '0'));
    },
    async recentSearches(limit = 10) {
      return [...searches.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .slice(0, limit)
        .map(([q]) => q);
    },
    async clearSearches() {
      searches.clear();
    },
  };
}

export function createMemoryFoodRepo(): FoodRepo {
  const custom: (CustomFood & { deleted: boolean })[] = [];
  const cached = new Map<string, CachedFood>();
  const favorites = new Map<string, string>();
  const key = (provider: string, providerId: string) => `${provider}:${providerId}`;
  const getCustom = async (id: string) => {
    const row = custom.find((r) => r.id === id && !r.deleted);
    if (!row) return null;
    const { deleted: _d, ...rest } = row;
    return clone(rest);
  };
  const insertCustom = async (food: NewCustomFood): Promise<CustomFood> => {
    if (!food.name.trim()) throw new Error('Food name is required');
    if (food.nutrition.calories < 0) throw new Error('Calories cannot be negative');
    const now = nowIso();
    const full = { ...clone(food), name: food.name.trim(), id: newId(), createdAt: now, updatedAt: now };
    custom.push({ ...full, deleted: false });
    return clone(full);
  };
  const matches = (needle: string, ...fields: (string | undefined)[]) =>
    fields.some((f) => (f ?? '').toLowerCase().includes(needle));
  const repo: FoodRepo = {
    async listCustomFoods(query) {
      const needle = query?.trim().toLowerCase();
      return custom
        .filter((r) => !r.deleted && (!needle || matches(needle, r.name, r.brand)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ deleted: _d, ...rest }) => clone(rest));
    },
    getCustomFood: getCustom,
    addCustomFood: insertCustom,
    async updateCustomFood(id, patch) {
      const row = custom.find((r) => r.id === id && !r.deleted);
      if (!row) throw new Error(`Custom food not found: ${id}`);
      Object.assign(row, clone(patch), { id, updatedAt: nowIso() });
      if (!row.name.trim()) throw new Error('Food name is required');
      if (row.nutrition.calories < 0) throw new Error('Calories cannot be negative');
      const { deleted: _d, ...rest } = row;
      return clone(rest);
    },
    async deleteCustomFood(id) {
      const row = custom.find((r) => r.id === id);
      if (row) row.deleted = true;
    },
    async duplicateCustomFood(id) {
      const existing = await getCustom(id);
      if (!existing) throw new Error(`Custom food not found: ${id}`);
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing;
      return insertCustom({ ...rest, name: `${existing.name} (copy)`, favorite: false });
    },
    async setCustomFavorite(id, favorite) {
      const row = custom.find((r) => r.id === id);
      if (row) row.favorite = favorite;
    },
    async findCustomByBarcode(barcode) {
      const row = custom
        .filter((r) => !r.deleted && r.barcode === barcode)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!row) return null;
      const { deleted: _d, ...rest } = row;
      return clone(rest);
    },
    async upsertCachedFoods(foods) {
      for (const food of foods) {
        const k = key(food.provider, food.providerId);
        const existing = cached.get(k);
        if (existing?.corrected) continue;
        cached.set(k, {
          ...clone(food),
          flagged: existing ? existing.flagged : food.flagged,
          corrected: existing?.corrected ?? food.corrected ?? false,
          verified: food.verified ?? false,
        });
      }
    },
    async upsertCachedFood(food) {
      await repo.upsertCachedFoods([food]);
    },
    async getCachedFood(provider, providerId) {
      const row = cached.get(key(provider, providerId));
      return row ? clone(row) : null;
    },
    async findCachedByBarcode(barcode) {
      const row = [...cached.values()]
        .filter((r) => r.barcode === barcode)
        .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))[0];
      return row ? clone(row) : null;
    },
    async searchCached(query, limit = 25) {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      return [...cached.values()]
        .filter((r) => matches(needle, r.name, r.brand, r.restaurant))
        .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))
        .slice(0, limit)
        .map(clone);
    },
    async setFlagged(provider, providerId, flagged) {
      const row = cached.get(key(provider, providerId));
      if (row) row.flagged = flagged;
    },
    async isFavorite(foodKey) {
      return favorites.has(foodKey);
    },
    async setFavorite(foodKey, favorite) {
      if (favorite) {
        if (!favorites.has(foodKey)) favorites.set(foodKey, nowIso());
      } else favorites.delete(foodKey);
    },
    async listFavoriteKeys() {
      return [...favorites.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([k]) => k);
    },
    async aiScanAvailable() {
      return false;
    },
    async ensureAiScanRoster() {},
    async analyzeFoodPhoto() {
      throw new Error('AI food scan is a Pro feature');
    },
  };
  return repo;
}

function createMemoryCollectionRepo<T extends SavedMeal | Recipe>(
  itemsField: 'items' | 'ingredients',
): CollectionRepo<T> {
  const rows: (T & { deleted: boolean })[] = [];
  const itemsOf = (entity: T) =>
    (entity as unknown as Record<string, { nutrition: Nutrition }[]>)[itemsField];
  const build = (items: CollectionInput['items']) =>
    items.map((it, position) => ({ ...clone(it), id: newId(), position }));
  const strip = (row: T & { deleted: boolean }): T => {
    const { deleted: _d, ...rest } = row;
    return clone(rest as unknown as T);
  };
  const repo: CollectionRepo<T> = {
    async list(query) {
      const needle = query?.trim().toLowerCase();
      return rows
        .filter((r) => !r.deleted && (!needle || r.name.toLowerCase().includes(needle)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(strip);
    },
    async get(id) {
      const row = rows.find((r) => r.id === id && !r.deleted);
      return row ? strip(row) : null;
    },
    async create(input) {
      if (!input.name.trim()) throw new Error('Name is required');
      if (input.servings <= 0) throw new Error('Servings must be positive');
      const now = nowIso();
      const row = {
        id: newId(),
        name: input.name.trim(),
        imageUrl: input.imageUrl,
        servings: input.servings,
        notes: input.notes,
        favorite: false,
        [itemsField]: build(input.items),
        createdAt: now,
        updatedAt: now,
        deleted: false,
      } as unknown as T & { deleted: boolean };
      rows.push(row);
      return strip(row);
    },
    async update(id, input) {
      const row = rows.find((r) => r.id === id && !r.deleted);
      if (!row) throw new Error(`Not found: ${id}`);
      const name = input.name ?? row.name;
      if (!name.trim()) throw new Error('Name is required');
      const servings = input.servings ?? row.servings;
      if (servings <= 0) throw new Error('Servings must be positive');
      row.name = name.trim();
      row.servings = servings;
      if (input.imageUrl !== undefined) row.imageUrl = input.imageUrl;
      if (input.notes !== undefined) row.notes = input.notes;
      if (input.items) (row as unknown as Record<string, unknown>)[itemsField] = build(input.items);
      row.updatedAt = nowIso();
      return strip(row);
    },
    async remove(id) {
      const row = rows.find((r) => r.id === id);
      if (row) row.deleted = true;
    },
    async duplicate(id) {
      const existing = await repo.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      return repo.create({
        name: `${existing.name} (copy)`,
        imageUrl: existing.imageUrl,
        servings: existing.servings,
        notes: existing.notes,
        items: (itemsOf(existing) as CollectionInput['items']).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          nutrition: it.nutrition,
          sourceType: it.sourceType,
          sourceId: it.sourceId,
        })),
      });
    },
    async setFavorite(id, favorite) {
      const row = rows.find((r) => r.id === id);
      if (row) row.favorite = favorite;
    },
    totalNutrition(entity) {
      return sumNutrition(itemsOf(entity).map((i) => i.nutrition));
    },
    perServing(entity) {
      const total = repo.totalNutrition(entity);
      return entity.servings > 0 ? scaleNutrition(total, 1 / entity.servings) : total;
    },
  };
  return repo;
}

export const createMemorySavedMealRepo = (): SavedMealRepo =>
  createMemoryCollectionRepo<SavedMeal>('items');
export const createMemoryRecipeRepo = (): RecipeRepo =>
  createMemoryCollectionRepo<Recipe>('ingredients');

/** Deletion is a server concern (convex/account.ts, covered by
 * tests/convex/isolation.test.ts); the fakes hold their state privately, so
 * this is a no-op rather than a half-implementation. */
export function createMemoryAccountRepo(): AccountRepo {
  return {
    async deleteAllData() {},
    async deleteAccount() {},
  };
}

export function createMemoryRepos(): Repos {
  return {
    account: createMemoryAccountRepo(),
    diary: createMemoryDiaryRepo(),
    activity: createMemoryActivityRepo(),
    dayNotes: createMemoryDayNotesRepo(),
    food: createMemoryFoodRepo(),
    goals: createMemoryGoalRepo(),
    savedMeals: createMemorySavedMealRepo(),
    recipes: createMemoryRecipeRepo(),
    history: createMemoryHistoryRepo(),
    settings: createMemorySettingsRepo(),
  };
}
