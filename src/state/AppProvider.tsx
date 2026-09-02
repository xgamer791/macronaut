import React, { createContext, useContext, useMemo } from 'react';
import { createAccountRepo, AccountRepo } from '@/repositories/accountRepo';
import { createActivityRepo, ActivityRepo } from '@/repositories/activityRepo';
import {
  createRecipeRepo,
  createSavedMealRepo,
  RecipeRepo,
  SavedMealRepo,
} from '@/repositories/collectionsRepo';
import { ConvexCaller } from '@/repositories/convexCall';
import { createDayNotesRepo, DayNotesRepo } from '@/repositories/dayNotesRepo';
import { createDiaryRepo, DiaryRepo } from '@/repositories/diaryRepo';
import { createFoodRepo, FoodRepo } from '@/repositories/foodRepo';
import { createGoalRepo, GoalRepo } from '@/repositories/goalRepo';
import { createHistoryRepo, HistoryRepo } from '@/repositories/historyRepo';
import { createSettingsRepo, SettingsRepo } from '@/repositories/settingsRepo';
import { getConvexClient } from '@/services/convex/client';

export interface Repos {
  diary: DiaryRepo;
  activity: ActivityRepo;
  dayNotes: DayNotesRepo;
  food: FoodRepo;
  goals: GoalRepo;
  savedMeals: SavedMealRepo;
  recipes: RecipeRepo;
  history: HistoryRepo;
  settings: SettingsRepo;
  account: AccountRepo;
}

const ReposContext = createContext<Repos | null>(null);

/** Repositories over the account's data on Convex. Which account is decided
 * by the session the Convex client carries, so there is nothing to scope
 * here — the server refuses rows that are not the caller's. */
export function createRepos(convex: ConvexCaller): Repos {
  return {
    diary: createDiaryRepo(convex),
    activity: createActivityRepo(convex),
    dayNotes: createDayNotesRepo(convex),
    food: createFoodRepo(convex),
    goals: createGoalRepo(convex),
    savedMeals: createSavedMealRepo(convex),
    recipes: createRecipeRepo(convex),
    history: createHistoryRepo(convex),
    settings: createSettingsRepo(convex),
    account: createAccountRepo(convex),
  };
}

export function AppProvider({
  children,
  repos: override,
}: {
  children: React.ReactNode;
  /** Test seam: supply repositories instead of building them on the client. */
  repos?: Repos;
}) {
  const repos = useMemo(() => override ?? createRepos(getConvexClient()), [override]);
  return <ReposContext.Provider value={repos}>{children}</ReposContext.Provider>;
}

export function useRepos(): Repos {
  const ctx = useContext(ReposContext);
  if (!ctx) throw new Error('useRepos must be used inside AppProvider');
  return ctx;
}
