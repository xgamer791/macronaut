import React, { createContext, useContext, useEffect, useState } from 'react';
import { Database } from '@/db/driver';
import { getDatabase } from '@/db';
import { createDiaryRepo, DiaryRepo } from '@/repositories/diaryRepo';
import { createActivityRepo, ActivityRepo } from '@/repositories/activityRepo';
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
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [repos, setRepos] = useState<Repos | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    getDatabase()
      .then((db) => {
        if (!mounted) return;
        setRepos({
          db,
          diary: createDiaryRepo(db),
          activity: createActivityRepo(db),
          food: createFoodRepo(db),
          goals: createGoalRepo(db),
          savedMeals: createSavedMealRepo(db),
          recipes: createRecipeRepo(db),
          history: createHistoryRepo(db),
          settings: createSettingsRepo(db),
        });
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) throw error;
  if (!repos) return <>{fallback}</>;
  return <ReposContext.Provider value={repos}>{children}</ReposContext.Provider>;
}

export function useRepos(): Repos {
  const ctx = useContext(ReposContext);
  if (!ctx) throw new Error('useRepos must be used inside AppProvider');
  return ctx;
}
