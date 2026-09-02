import { api } from '../../convex/_generated/api';
import { UnitSystem, WeekStart } from '@/domain/types';
import { ConvexCaller } from './convexCall';
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

/** Settings live in the account on Convex as JSON text per key, so any shape
 * can be stored without a schema change. */
export function createSettingsRepo(convex: ConvexCaller): SettingsRepo {
  async function get<T>(key: string, fallback: T): Promise<T> {
    const raw = await convex.query(api.settings.get, { key });
    return raw === null ? fallback : safeParse<T>(raw, fallback);
  }

  async function set<T>(key: string, value: T): Promise<void> {
    await convex.mutation(api.settings.set, { key, value: JSON.stringify(value) });
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
    getMealCategories: () => convex.query(api.mealCategories.list, {}),
    addMealCategory: (name) => convex.mutation(api.mealCategories.add, { name }),
  };
}
