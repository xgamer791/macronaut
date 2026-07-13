import { Database } from '@/db/driver';
import { UnitSystem, WeekStart } from '@/domain/types';
import { safeParse } from './util';
import { MealCategory } from './types';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface OnboardingProfile {
  age?: number;
  sex?: 'male' | 'female';
  heightCm?: number;
  weightKg?: number;
  goalWeightKg?: number;
  activity?: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
  goalType?: 'lose' | 'maintain' | 'gain' | 'muscle';
  weeklyRateKg?: number;
}

export interface SettingsRepo {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  getOnboardingComplete(): Promise<boolean>;
  setOnboardingComplete(complete: boolean): Promise<void>;
  getProfile(): Promise<OnboardingProfile>;
  setProfile(profile: OnboardingProfile): Promise<void>;
  getUnitSystem(): Promise<UnitSystem>;
  setUnitSystem(units: UnitSystem): Promise<void>;
  getWeekStart(): Promise<WeekStart>;
  setWeekStart(start: WeekStart): Promise<void>;
  getAppearance(): Promise<AppearanceMode>;
  setAppearance(mode: AppearanceMode): Promise<void>;
  getMealCategories(): Promise<MealCategory[]>;
  addMealCategory(name: string): Promise<MealCategory>;
}

export function createSettingsRepo(db: Database): SettingsRepo {
  async function get<T>(key: string, fallback: T): Promise<T> {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row ? safeParse<T>(row.value, fallback) : fallback;
  }

  async function set<T>(key: string, value: T): Promise<void> {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)],
    );
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
      const rows = await db.getAllAsync<{
        id: string;
        name: string;
        position: number;
        builtin: number;
      }>('SELECT id, name, position, builtin FROM meal_categories WHERE deleted = 0 ORDER BY position');
      return rows.map((r) => ({ ...r, builtin: r.builtin === 1 }));
    },

    async addMealCategory(name: string) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Meal name is required');
      const max = await db.getFirstAsync<{ m: number | null }>(
        'SELECT MAX(position) as m FROM meal_categories',
      );
      const position = (max?.m ?? 0) + 1;
      const id = `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${position}`;
      await db.runAsync(
        'INSERT INTO meal_categories (id, name, position, builtin) VALUES (?, ?, ?, 0)',
        [id, trimmed, position],
      );
      return { id, name: trimmed, position, builtin: false };
    },
  };
}
