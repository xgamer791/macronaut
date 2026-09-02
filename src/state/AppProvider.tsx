import React, { createContext, useContext, useEffect, useState } from 'react';
import { Database } from '@/db/driver';
import { getDatabase } from '@/db';
import { createDiaryRepo, DiaryRepo } from '@/repositories/diaryRepo';
import { createActivityRepo, ActivityRepo } from '@/repositories/activityRepo';
import { createDayNotesRepo, DayNotesRepo } from '@/repositories/dayNotesRepo';
import { createFoodRepo, FoodRepo } from '@/repositories/foodRepo';
import { createGoalRepo, GoalRepo } from '@/repositories/goalRepo';
import {
  createRecipeRepo,
  createSavedMealRepo,
  RecipeRepo,
  SavedMealRepo,
} from '@/repositories/collectionsRepo';
import { createHistoryRepo, HistoryRepo } from '@/repositories/historyRepo';
import { createSettingsRepo, SettingsRepo } from '@/repositories/settingsRepo';

export interface Repos {
  db: Database;
  diary: DiaryRepo;
  activity: ActivityRepo;
  dayNotes: DayNotesRepo;
  food: FoodRepo;
  goals: GoalRepo;
  savedMeals: SavedMealRepo;
  recipes: RecipeRepo;
  history: HistoryRepo;
  settings: SettingsRepo;
}

const ReposContext = createContext<Repos | null>(null);

export function AppProvider({
  children,
  fallback = null,
  scope,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Which account's local database to open. Omit for the device default. */
  scope?: string;
}) {
  // Repositories are tagged with the scope they were built for, so a scope
  // change can never hand a screen repositories pointing at another account's
  // database while the new one opens.
  const [loaded, setLoaded] = useState<{ scope: string | undefined; repos: Repos } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    getDatabase(scope)
      .then((db) => {
        if (!mounted) return;
        setLoaded({
          scope,
          repos: {
            db,
            diary: createDiaryRepo(db),
            activity: createActivityRepo(db),
            dayNotes: createDayNotesRepo(db),
            food: createFoodRepo(db),
            goals: createGoalRepo(db),
            savedMeals: createSavedMealRepo(db),
            recipes: createRecipeRepo(db),
            history: createHistoryRepo(db),
            settings: createSettingsRepo(db),
          },
        });
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      mounted = false;
    };
  }, [scope]);

  if (error) throw error;
  const repos = loaded && loaded.scope === scope ? loaded.repos : null;
  if (!repos) return <>{fallback}</>;
  return <ReposContext.Provider value={repos}>{children}</ReposContext.Provider>;
}

export function useRepos(): Repos {
  const ctx = useContext(ReposContext);
  if (!ctx) throw new Error('useRepos must be used inside AppProvider');
  return ctx;
}
