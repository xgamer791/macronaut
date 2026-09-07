import React, { createContext, useContext, useMemo } from 'react';
import { createAccountRepo, AccountRepo } from '@/repositories/accountRepo';
import { createChatRepo, ChatRepo } from '@/repositories/chatRepo';
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
import { createFastingRepo, FastingRepo } from '@/repositories/fastingRepo';
import { createGoalRepo, GoalRepo } from '@/repositories/goalRepo';
import { createGroupRepo, GroupRepo } from '@/repositories/groupRepo';
import { createHistoryRepo, HistoryRepo } from '@/repositories/historyRepo';
import { createNotificationRepo, NotificationRepo } from '@/repositories/notificationRepo';
import { createPhotoRepo, PhotoRepo } from '@/repositories/photoRepo';
import { createProfileRepo, ProfileRepo } from '@/repositories/profileRepo';
import { createSettingsRepo, SettingsRepo } from '@/repositories/settingsRepo';
import {
  createTrainingScheduleRepo,
  TrainingScheduleRepo,
} from '@/repositories/trainingScheduleRepo';
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
  profile: ProfileRepo;
  photos: PhotoRepo;
  groups: GroupRepo;
  account: AccountRepo;
  chats: ChatRepo;
  notifications: NotificationRepo;
  fasting: FastingRepo;
  trainingSchedule: TrainingScheduleRepo;
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
    profile: createProfileRepo(convex),
    photos: createPhotoRepo(convex),
    groups: createGroupRepo(convex),
    account: createAccountRepo(convex),
    chats: createChatRepo(convex),
    notifications: createNotificationRepo(convex),
    fasting: createFastingRepo(convex),
    trainingSchedule: createTrainingScheduleRepo(convex),
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
