/** In-memory repositories for the Jest suites that exercise services on top
 * of the repository interfaces (food engine, demo seed).
 * Persistence itself is covered by tests/convex, which runs the real Convex
 * functions; these fakes only need the interface contract. */
import { sumNutrition, scaleNutrition } from '@/domain/nutrition';
import { AccountRepo } from '@/repositories/accountRepo';
import {
  ChatMessage,
  ChatPerson,
  ChatRepo,
  ChatSummary,
  ChatThread,
} from '@/repositories/chatRepo';
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
import { FastingRepo, FastingState } from '@/repositories/fastingRepo';
import { GoalRepo } from '@/repositories/goalRepo';
import { FrequentFood, HistoryRepo, RecentFood } from '@/repositories/historyRepo';
import { AppNotification, NotificationRepo } from '@/repositories/notificationRepo';
import { FitnessGroup, GroupRepo } from '@/repositories/groupRepo';
import {
  GroupChatRepo,
  GroupChatSummary,
  GroupChatThread,
  GroupMessage,
} from '@/repositories/groupChatRepo';
import { GymCandidate, GymRepo, MyGym } from '@/repositories/gymRepo';
import { ProfilePhoto, PhotoComment, PhotoRepo, PhotoThread } from '@/repositories/photoRepo';
import {
  ConnectionPerson,
  ProfilePost,
  ProfilePostComment,
  ProfileRepo,
  ProfilePostThread,
  ProfileView,
} from '@/repositories/profileRepo';
import { AppearanceMode, OnboardingProfile, SettingsRepo } from '@/repositories/settingsRepo';
import { TrainingScheduleDay, TrainingScheduleRepo } from '@/repositories/trainingScheduleRepo';
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
import { DayKey, rangeDays, weekdayOf } from '@/utils/date';

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
  const logs: {
    foodKey: string;
    name: string;
    meal: string;
    imageUrl?: string;
    loggedAt: string;
  }[] = [];
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
            (meal ? b.mealCount - a.mealCount : 0) ||
            b.count - a.count ||
            b.last.localeCompare(a.last),
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
    const full = {
      ...clone(food),
      name: food.name.trim(),
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
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

export function createMemoryProfileRepo(): ProfileRepo {
  const posts: ProfilePost[] = [];
  const postLikes = new Map<string, Set<string>>();
  const postComments: (ProfilePostComment & { postId: string })[] = [];
  /** Who follows this profile. A friend request from an account puts it in
   * here, which is all the counts and the connections lists read. */
  const followers: ConnectionPerson[] = [];
  let saved = false;
  let profile: ProfileView = {
    id: null,
    handle: 'athlete',
    isPublic: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    postCount: 0,
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    isOwner: true,
    saved: false,
  };
  const view = (): ProfileView =>
    clone({ ...profile, postCount: posts.length, followerCount: followers.length, saved });
  const touch = () => {
    saved = true;
    profile = { ...profile, id: profile.id ?? newId(), updatedAt: nowIso() };
  };
  const repo: ProfileRepo = {
    async ensure() {
      touch();
      return { handle: profile.handle };
    },
    async me() {
      return view();
    },
    async myPosts() {
      return posts.map(clone);
    },
    async friendsFeed() {
      return { page: [], isDone: true, continueCursor: '' };
    },
    async byHandle(handle) {
      if (handle.toLowerCase() !== profile.handle) return null;
      if (!profile.isPublic) return null;
      return { profile: view(), posts: posts.map(clone) };
    },
    async update(patch) {
      touch();
      profile = { ...profile, ...clone(patch) };
      return view();
    },
    async uploadImage() {
      return newId();
    },
    async setImage(kind, storageId) {
      touch();
      const url = storageId ? `memory://${storageId}` : undefined;
      profile = kind === 'avatar' ? { ...profile, avatarUrl: url } : { ...profile, bannerUrl: url };
      return view();
    },
    async addPost(body, imageId) {
      const trimmed = body.trim();
      if (!trimmed && !imageId) throw new Error('A post needs some words or a photo');
      touch();
      const ts = nowIso();
      const post: ProfilePost = {
        id: newId(),
        body: trimmed,
        imageUrl: imageId ? `memory://${imageId}` : undefined,
        createdAt: ts,
        updatedAt: ts,
        likeCount: 0,
        likedByMe: false,
        commentCount: 0,
      };
      posts.unshift(post);
      return clone(post);
    },
    async updatePost(id, body) {
      const post = posts.find((p) => p.id === id);
      if (!post) throw new Error('Post not found');
      const trimmed = body.trim();
      if (!trimmed && !post.imageUrl) throw new Error('A post needs some words or a photo');
      post.body = trimmed;
      post.updatedAt = nowIso();
      return clone(post);
    },
    async postThread(id) {
      const post = posts.find((row) => row.id === id);
      if (!post) return null;
      const likes = postLikes.get(id) ?? new Set<string>();
      const comments = postComments.filter((row) => row.postId === id);
      const thread: ProfilePostThread = {
        likeCount: likes.size,
        likedByMe: likes.has('me'),
        commentCount: comments.length,
        comments: comments.map(({ postId: _postId, ...row }) => clone(row)),
      };
      return thread;
    },
    async setPostLike(id, liked) {
      const post = posts.find((row) => row.id === id);
      if (!post) throw new Error('Post not found');
      const likes = postLikes.get(id) ?? new Set<string>();
      if (liked) likes.add('me');
      else likes.delete('me');
      postLikes.set(id, likes);
      post.likeCount = likes.size;
      post.likedByMe = likes.has('me');
      return clone(post);
    },
    async addPostComment(id, body) {
      const post = posts.find((row) => row.id === id);
      if (!post) throw new Error('Post not found');
      const comment = {
        id: newId(),
        postId: id,
        body: body.trim(),
        createdAt: nowIso(),
        authorName: 'You',
        authorHandle: 'you',
        isMine: true,
      };
      postComments.push(comment);
      post.commentCount = postComments.filter((row) => row.postId === id).length;
      return clone(comment);
    },
    async removePostComment(id) {
      const at = postComments.findIndex((row) => row.id === id);
      if (at < 0) return;
      const postId = postComments[at]!.postId;
      postComments.splice(at, 1);
      const post = posts.find((row) => row.id === postId);
      if (post) post.commentCount = postComments.filter((row) => row.postId === postId).length;
    },
    async removePost(id) {
      const i = posts.findIndex((p) => p.id === id);
      if (i >= 0) posts.splice(i, 1);
      postLikes.delete(id);
      for (let i = postComments.length - 1; i >= 0; i--) {
        if (postComments[i]!.postId === id) postComments.splice(i, 1);
      }
    },
    async setFollow(handle, follow) {
      if (handle.toLowerCase() !== profile.handle || !profile.isPublic) {
        throw new Error('Profile not available');
      }
      return repo.requestFriend(profile.id ?? '', follow);
    },
    async requestFriend(userId, follow) {
      const at = followers.findIndex((person) => person.id === userId);
      if (follow && at < 0) {
        followers.push({
          id: userId,
          handle: null,
          displayName: 'Macronaut member',
          friendship: profile.isFollowedBy ? 'friends' : 'outgoing',
          isYou: false,
        });
      } else if (!follow && at >= 0) {
        followers.splice(at, 1);
      }
      profile = { ...profile, isFollowing: follow };
      return view();
    },
    /** Only the follower side is modelled, which is the side friend requests
     * write. Who this profile follows lives on the server. */
    async connections({ handle, tab, search }) {
      if (handle && handle.toLowerCase() !== profile.handle) return null;
      const friends = followers.filter((person) => person.friendship === 'friends');
      const wanted = (search ?? '').trim().toLowerCase().replace(/^@+/, '');
      const list = tab === 'followers' ? followers : tab === 'friends' ? friends : [];
      return {
        subject: { handle: profile.handle, displayName: profile.displayName ?? profile.handle },
        counts: {
          followers: followers.length,
          following: profile.followingCount,
          friends: friends.length,
        },
        people: list
          .filter(
            (person) =>
              !wanted ||
              person.displayName.toLowerCase().includes(wanted) ||
              (person.handle ?? '').includes(wanted),
          )
          .map(clone),
      };
    },
  };
  return repo;
}

export function createMemoryPhotoRepo(): PhotoRepo {
  const photos: ProfilePhoto[] = [];
  const likes = new Map<string, Set<string>>();
  const comments: PhotoComment[] = [];

  function threadFor(photo: ProfilePhoto): PhotoThread {
    const liked = likes.get(photo.id) ?? new Set();
    return {
      photo: clone(photo),
      ownerName: 'You',
      ownerHandle: 'you',
      likeCount: liked.size,
      likedByMe: liked.has('me'),
      comments: comments.filter((row) => row.id.startsWith(photo.id)).map(clone),
    };
  }

  return {
    async mine() {
      return photos.map(clone);
    },
    async forHandle() {
      return { isOwner: true, photos: photos.filter((p) => p.isPublic).map(clone) };
    },
    async thread(id) {
      const photo = photos.find((p) => p.id === id);
      return photo ? threadFor(photo) : null;
    },
    async upload() {
      return newId();
    },
    async add(imageId, caption, isPublic = true) {
      const ts = nowIso();
      const photo: ProfilePhoto = {
        id: newId(),
        imageUrl: `memory://${imageId}`,
        caption,
        isPublic,
        createdAt: ts,
        updatedAt: ts,
      };
      photos.unshift(photo);
      return clone(photo);
    },
    async addMany(imageIds, isPublic = true) {
      const added: ProfilePhoto[] = [];
      // Unshift last-selected first so the first selected photo leads the wall.
      for (let i = imageIds.length - 1; i >= 0; i--) {
        added.unshift(await this.add(imageIds[i]!, undefined, isPublic));
      }
      return added;
    },
    async setPublic(id, isPublic) {
      const photo = photos.find((p) => p.id === id);
      if (!photo) throw new Error('Photo not found');
      photo.isPublic = isPublic;
      photo.updatedAt = nowIso();
      return clone(photo);
    },
    async setLike(id, liked) {
      const photo = photos.find((p) => p.id === id);
      if (!photo) throw new Error('Photo not found');
      const set = likes.get(id) ?? new Set<string>();
      if (liked) set.add('me');
      else set.delete('me');
      likes.set(id, set);
      return threadFor(photo);
    },
    async addComment(id, body) {
      const photo = photos.find((p) => p.id === id);
      if (!photo) throw new Error('Photo not found');
      const comment: PhotoComment = {
        id: `${id}-${newId()}`,
        body: body.trim(),
        createdAt: nowIso(),
        authorName: 'You',
        authorHandle: 'you',
        isMine: true,
      };
      comments.push(comment);
      return clone(comment);
    },
    async removeComment(id) {
      const i = comments.findIndex((row) => row.id === id);
      if (i >= 0) comments.splice(i, 1);
    },
    async remove(id) {
      const i = photos.findIndex((p) => p.id === id);
      if (i >= 0) photos.splice(i, 1);
      likes.delete(id);
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i]!.id.startsWith(id)) comments.splice(i, 1);
      }
    },
  };
}

export function createMemoryGroupRepo(): GroupRepo {
  const groups: FitnessGroup[] = [];
  return {
    async mine() {
      return groups.map(clone);
    },
    async discover() {
      return {
        groups: groups.filter((group) => group.isPublic && !group.isMember).map(clone),
      };
    },
    async forHandle() {
      return { isOwner: true, groups: groups.filter((g) => g.isPublic).map(clone) };
    },
    async create(input) {
      const ts = nowIso();
      const group: FitnessGroup = {
        id: newId(),
        name: input.name.trim(),
        handle: input.name.trim().toLowerCase().replace(/\s+/g, '_'),
        sport: input.sport,
        location: input.location,
        description: input.description,
        isPublic: input.isPublic ?? true,
        memberCount: 1,
        isOwner: true,
        isMember: true,
        createdAt: ts,
        updatedAt: ts,
      };
      groups.unshift(group);
      return clone(group);
    },
    async update(id, input) {
      const group = groups.find((candidate) => candidate.id === id);
      if (!group || !group.isOwner) throw new Error('Only the owner can edit this group');
      Object.assign(group, {
        name: input.name.trim(),
        sport: input.sport,
        location: input.location,
        description: input.description,
        isPublic: input.isPublic ?? group.isPublic,
        updatedAt: nowIso(),
      });
      return clone(group);
    },
    async join(id) {
      const group = groups.find((g) => g.id === id);
      if (!group || !group.isPublic) throw new Error('Group not available');
      group.isMember = true;
      group.memberCount += 1;
      return clone(group);
    },
    async leave(id) {
      const group = groups.find((g) => g.id === id);
      if (group) {
        group.isMember = false;
        group.memberCount = Math.max(0, group.memberCount - 1);
      }
    },
    async remove(id) {
      const i = groups.findIndex((g) => g.id === id);
      if (i >= 0) groups.splice(i, 1);
    },
    async members() {
      return { total: 0, listed: 0, members: [] };
    },
    async voteRemove() {
      return { votes: 1, status: 'member' as const, myVote: true };
    },
    async retractVote() {
      return { votes: 0, status: 'member' as const, myVote: false };
    },
  };
}

/** Two gyms near Venice Beach and a claim that takes; enough for the picker
 * and the profile to be exercised without a places key. */
export function createMemoryGymRepo(): GymRepo {
  const catalogue: GymCandidate[] = [
    {
      id: 'gym-golds-venice',
      name: "Gold's Gym Venice",
      address: '360 Hampton Dr, Venice, CA 90291, USA',
      lat: 33.9946,
      lng: -118.4747,
      distanceM: 800,
      memberCount: 3,
    },
    {
      id: 'gym-planet-venice',
      name: 'Planet Fitness',
      address: '1234 Lincoln Blvd, Venice, CA 90291, USA',
      lat: 33.99,
      lng: -118.46,
      distanceM: 2400,
      memberCount: 0,
    },
  ];
  let current: MyGym | null = null;
  const groupFor = (gym: GymCandidate): FitnessGroup => {
    const ts = nowIso();
    return {
      id: `group-${gym.id}`,
      name: gym.name,
      handle: gym.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      sport: 'Gym',
      location: 'Venice, CA',
      description: `Everyone on Macronaut whose home gym is ${gym.name}.`,
      isPublic: true,
      kind: 'gym',
      gymId: gym.id,
      memberCount: gym.memberCount + 1,
      isOwner: false,
      isMember: true,
      createdAt: ts,
      updatedAt: ts,
    };
  };
  return {
    async available() {
      return true;
    },
    async geocode(address) {
      return { lat: 33.99, lng: -118.47, label: address };
    },
    async searchGyms({ query }) {
      const wanted = query.trim().toLowerCase();
      return catalogue.filter((gym) => gym.name.toLowerCase().includes(wanted)).map(clone);
    },
    async mine() {
      return current ? clone(current) : null;
    },
    async claim({ gymId, joinGroup }) {
      const gym = catalogue.find((candidate) => candidate.id === gymId);
      if (!gym) throw new Error('Gym not available');
      const { distanceM: _d, memberCount: _m, ...summary } = gym;
      current = { gym: summary, group: joinGroup ? groupFor(gym) : null, restriction: null };
      return clone(current);
    },
    async joinGroup() {
      if (!current) throw new Error('Set a home gym first');
      const gym = catalogue.find((candidate) => candidate.id === current?.gym.id);
      if (!gym) throw new Error('Gym not available');
      current.group = groupFor(gym);
      return clone(current.group);
    },
    async clear() {
      current = null;
    },
  };
}

export function createMemoryChatRepo(): ChatRepo {
  const chats: ChatSummary[] = [];
  /** Handles the stub has seen, so opening by handle twice reuses one chat. */
  const byHandle = new Map<string, string>();
  const messages = new Map<string, ChatMessage[]>();
  /** Stand-in storage: an upload just hands back an id the send can quote. */
  const uploads = new Map<string, Blob>();
  const me: ChatPerson = {
    id: 'me',
    handle: null,
    displayName: 'You',
    friendship: 'friends',
  };

  return {
    async list() {
      return clone(chats);
    },
    async people() {
      return [];
    },
    async open(userId) {
      const existing = chats.find((chat) => chat.peer.id === userId);
      if (existing) return clone(existing);
      const ts = nowIso();
      const chat: ChatSummary = {
        id: newId(),
        peer: { id: userId, handle: null, displayName: 'Macronaut member', friendship: 'friends' },
        lastMessage: null,
        unreadCount: 0,
        createdAt: ts,
        updatedAt: ts,
      };
      chats.unshift(chat);
      messages.set(chat.id, []);
      return clone(chat);
    },
    async openByHandle(handle) {
      const known = byHandle.get(handle.toLowerCase());
      const existing = known ? chats.find((chat) => chat.peer.id === known) : undefined;
      if (existing) return clone(existing);
      const chat = await this.open(newId());
      byHandle.set(handle.toLowerCase(), chat.peer.id);
      return { ...chat, peer: { ...chat.peer, handle } };
    },
    async thread(id) {
      const chat = chats.find((row) => row.id === id);
      if (!chat) return null;
      const thread: ChatThread = {
        ...clone(chat),
        me: clone(me),
        messages: clone(messages.get(id) ?? []),
      };
      return thread;
    },
    async upload(file) {
      const id = newId();
      uploads.set(id, file);
      return id;
    },
    async send(id, body, attachment) {
      const chat = chats.find((row) => row.id === id);
      if (!chat) throw new Error('Chat not available');
      const message: ChatMessage = {
        id: newId(),
        body: body.trim(),
        createdAt: nowIso(),
        isMine: true,
        ...(attachment
          ? {
              media: {
                url: `memory://${attachment.mediaId}`,
                kind: attachment.kind,
                width: attachment.width,
                height: attachment.height,
              },
            }
          : {}),
      };
      messages.get(id)?.push(message);
      chat.lastMessage = message;
      chat.updatedAt = message.createdAt;
      return clone(message);
    },
    async markRead(id) {
      const chat = chats.find((row) => row.id === id);
      if (chat) chat.unreadCount = 0;
    },
  };
}

export function createMemoryNotificationRepo(): NotificationRepo {
  const items: AppNotification[] = [];
  return {
    async list() {
      return { items: clone(items), unreadCount: items.filter((item) => !item.read).length };
    },
    async markRead(id) {
      const item = items.find((row) => row.id === id);
      if (item) item.read = true;
    },
    async markAllRead() {
      for (const item of items) item.read = true;
    },
  };
}

export function createMemoryTrainingScheduleRepo(): TrainingScheduleRepo {
  const days: TrainingScheduleDay[] = [];
  const repeats = new Set<number>();
  const templates = new Map<number, TrainingScheduleDay>();
  return {
    async range(from, to) {
      const exact = new Map(
        days.filter((day) => day.date >= from && day.date <= to).map((day) => [day.date, day]),
      );
      return rangeDays(from, to).flatMap((date) => {
        const saved = exact.get(date);
        if (saved) return [clone(saved)];
        const template = templates.get(weekdayOf(date));
        if (!repeats.has(weekdayOf(date)) || !template || template.date > date) return [];
        return [clone({ ...template, id: `${template.id}:${date}`, date })];
      });
    },
    async repeatDays() {
      return [...repeats].sort((a, b) => a - b);
    },
    async save(input) {
      const index = days.findIndex((day) => day.date === input.date);
      const previous = index >= 0 ? days[index] : undefined;
      const timestamp = nowIso();
      const day: TrainingScheduleDay = {
        ...clone(input),
        id: previous?.id ?? newId(),
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      if (index >= 0) days[index] = day;
      else days.push(day);
      if (repeats.has(weekdayOf(day.date))) templates.set(weekdayOf(day.date), clone(day));
      return clone(day);
    },
    async setRepeatDay(date, enabled) {
      const weekday = weekdayOf(date);
      if (enabled) {
        repeats.add(weekday);
        const source = days.find((day) => day.date === date);
        if (source) templates.set(weekday, clone(source));
      } else {
        repeats.delete(weekday);
      }
      return [...repeats].sort((a, b) => a - b);
    },
    async setRepeatAll(dates, enabled) {
      for (const date of dates) {
        const weekday = weekdayOf(date);
        if (enabled) {
          repeats.add(weekday);
          const source = days.find((day) => day.date === date);
          if (source) templates.set(weekday, clone(source));
        } else {
          repeats.delete(weekday);
        }
      }
      return [...repeats].sort((a, b) => a - b);
    },
    async remove(date) {
      const index = days.findIndex((day) => day.date === date);
      if (index >= 0) days.splice(index, 1);
      repeats.delete(weekdayOf(date));
    },
  };
}

export function createMemoryFastingRepo(): FastingRepo {
  let current: FastingState = {
    activeStartAt: null,
    activeEndAt: null,
    customSlots: [],
    updatedAt: null,
  };
  return {
    async state() {
      return clone(current);
    },
    async start(startAt, endAt) {
      if (endAt <= startAt) throw new Error('The fast must end after it starts');
      current = { ...current, activeStartAt: startAt, activeEndAt: endAt, updatedAt: nowIso() };
    },
    async stop() {
      current = { ...current, activeStartAt: null, activeEndAt: null, updatedAt: nowIso() };
    },
    async saveSlot(label, durationMinutes) {
      if (current.customSlots.length >= 10) {
        throw new Error('You can save up to 10 custom fasting times');
      }
      const slot = { id: newId(), label: label.trim(), durationMinutes };
      current = {
        ...current,
        customSlots: [...current.customSlots, slot],
        updatedAt: nowIso(),
      };
      return clone(slot);
    },
    async removeSlot(id) {
      current = {
        ...current,
        customSlots: current.customSlots.filter((slot) => slot.id !== id),
        updatedAt: nowIso(),
      };
    },
  };
}

/** Deletion is a server concern (convex/account.ts, covered by
 * tests/convex/isolation.test.ts); the fakes hold their state privately, so
 * this is a no-op rather than a half-implementation. */
export function createMemoryAccountRepo(): AccountRepo {
  return {
    // No accounts here, so every address is free.
    async emailTaken() {
      return false;
    },
    async deleteAllData() {},
    async deleteAccount() {},
  };
}

/** Group chats the stub knows about: one thread per group id the screen
 * asks for, with the caller as the only sender. */
export function createMemoryGroupChatRepo(): GroupChatRepo {
  const threads = new Map<string, GroupChatThread>();
  const me: ChatPerson = {
    id: 'me',
    handle: null,
    displayName: 'You',
    friendship: 'friends',
  };
  const groupFor = (id: string): FitnessGroup => {
    const ts = nowIso();
    return {
      id,
      name: 'Your group',
      handle: 'your_group',
      isPublic: true,
      memberCount: 1,
      isOwner: false,
      isMember: true,
      createdAt: ts,
      updatedAt: ts,
    };
  };
  const threadFor = (id: string): GroupChatThread => {
    const existing = threads.get(id);
    if (existing) return existing;
    const thread: GroupChatThread = {
      group: groupFor(id),
      me: clone(me),
      messages: [],
      unreadCount: 0,
      lastMessageAt: null,
    };
    threads.set(id, thread);
    return thread;
  };

  return {
    async list() {
      const rows: GroupChatSummary[] = [];
      for (const thread of threads.values()) {
        const last = thread.messages[thread.messages.length - 1];
        if (!last || !thread.lastMessageAt) continue;
        rows.push({
          group: clone(thread.group),
          lastMessage: {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt,
            isMine: last.isMine,
            senderName: last.sender.displayName,
            mediaKind: last.media?.kind,
          },
          unreadCount: thread.unreadCount,
          lastMessageAt: thread.lastMessageAt,
        });
      }
      return rows.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    },
    async thread(id) {
      return clone(threadFor(id));
    },
    async send(id, body, attachment) {
      const thread = threadFor(id);
      const message: GroupMessage = {
        id: newId(),
        body: body.trim(),
        createdAt: nowIso(),
        isMine: true,
        sender: clone(me),
        canDelete: true,
        ...(attachment
          ? {
              media: {
                url: `memory://${attachment.mediaId}`,
                kind: attachment.kind,
                width: attachment.width,
                height: attachment.height,
              },
            }
          : {}),
      };
      thread.messages.push(message);
      thread.lastMessageAt = message.createdAt;
      return clone(message);
    },
    async markRead(id) {
      threadFor(id).unreadCount = 0;
    },
    async remove(messageId) {
      for (const thread of threads.values()) {
        const at = thread.messages.findIndex((message) => message.id === messageId);
        if (at < 0) continue;
        thread.messages.splice(at, 1);
        thread.lastMessageAt = thread.messages[thread.messages.length - 1]?.createdAt ?? null;
      }
    },
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
    profile: createMemoryProfileRepo(),
    photos: createMemoryPhotoRepo(),
    groups: createMemoryGroupRepo(),
    gyms: createMemoryGymRepo(),
    chats: createMemoryChatRepo(),
    groupChats: createMemoryGroupChatRepo(),
    notifications: createMemoryNotificationRepo(),
    fasting: createMemoryFastingRepo(),
    trainingSchedule: createMemoryTrainingScheduleRepo(),
  };
}
