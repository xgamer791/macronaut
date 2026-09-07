import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DayKey, weekdayOf, weekDays } from '@/utils/date';
import { DayProgress, WeekProgress, dayProgress, weekProgress } from '@/domain/aggregation';
import { DayType, GoalConfig, classifyDay } from '@/domain/goals';
import { WeekStart } from '@/domain/types';
import { NewActivityEntry } from '@/repositories/activityRepo';
import { NewDiaryEntry } from '@/repositories/diaryRepo';
import { ProfileImageKind, ProfilePatch } from '@/repositories/profileRepo';
import type { PickedAttachment } from '@/services/media/pickedAttachment';
import { TrainingScheduleDayInput } from '@/repositories/trainingScheduleRepo';
import { DiaryEntry, MealCategory } from '@/repositories/types';
import { useRepos } from './AppProvider';
import { useAuth } from './AuthProvider';

const GUEST_MEALS: MealCategory[] = [
  { id: 'breakfast', name: 'Breakfast', position: 0, builtin: true },
  { id: 'lunch', name: 'Lunch', position: 1, builtin: true },
  { id: 'dinner', name: 'Dinner', position: 2, builtin: true },
  { id: 'snacks', name: 'Snacks', position: 3, builtin: true },
];

/** Query keys — every mutation invalidates by prefix so Today, Diary, weekly
 * and Progress views recompute immediately after any change. */
export const keys = {
  diary: (date: DayKey) => ['diary', date] as const,
  diaryRange: (from: DayKey, to: DayKey) => ['diary-range', from, to] as const,
  activity: (date: DayKey) => ['activity', date] as const,
  activityRange: (from: DayKey, to: DayKey) => ['activity-range', from, to] as const,
  dayNotes: (date: DayKey) => ['day-notes', date] as const,
  dayNotesRange: (from: DayKey, to: DayKey) => ['day-notes-range', from, to] as const,
  goals: ['goals'] as const,
  marks: ['marks'] as const,
  setting: (key: string) => ['setting', key] as const,
  mealCategories: ['meal-categories'] as const,
  customFoods: (q: string) => ['custom-foods', q] as const,
  savedMeals: (q: string) => ['saved-meals', q] as const,
  recipes: (q: string) => ['recipes', q] as const,
  recents: ['recents'] as const,
  frequents: (meal?: string) => ['frequents', meal ?? ''] as const,
  favorites: ['favorites'] as const,
  aiScanAvailable: ['ai-scan-available'] as const,
  emailTaken: (email: string) => ['email-taken', email] as const,
  profile: ['profile'] as const,
  profilePosts: ['profile-posts'] as const,
  friendsFeed: ['friends-feed'] as const,
  publicProfile: (handle: string) => ['public-profile', handle] as const,
  photos: ['photos'] as const,
  publicPhotos: (handle: string) => ['public-photos', handle] as const,
  photoThread: (id: string) => ['photo-thread', id] as const,
  groups: ['groups'] as const,
  groupDiscovery: ['group-discovery'] as const,
  publicGroups: (handle: string) => ['public-groups', handle] as const,
  chats: ['chats'] as const,
  chatPeople: (search: string) => ['chat-people', search] as const,
  chatThread: (id: string) => ['chat-thread', id] as const,
  notifications: ['notifications'] as const,
  fasting: ['fasting'] as const,
  trainingSchedule: (from: DayKey, to: DayKey) => ['training-schedule', from, to] as const,
  trainingScheduleRepeats: ['training-schedule-repeats'] as const,
};

export function useInvalidateDiary() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['diary'] });
    qc.invalidateQueries({ queryKey: ['diary-range'] });
    qc.invalidateQueries({ queryKey: keys.recents });
    qc.invalidateQueries({ queryKey: ['frequents'] });
  };
}

export function useInvalidateActivity() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['activity'] });
    qc.invalidateQueries({ queryKey: ['activity-range'] });
  };
}

export function useDayNotes(date: DayKey) {
  const { signedIn } = useAuth();
  const { dayNotes } = useRepos();
  return useQuery({
    queryKey: keys.dayNotes(date),
    queryFn: () => dayNotes.listForDate(date),
    enabled: signedIn,
  });
}

/** Pass `enabled` to hold the fetch back while the screen asking is closed. */
export function useDayNotesRange(from: DayKey, to: DayKey, enabled?: boolean) {
  const { signedIn } = useAuth();
  const { dayNotes } = useRepos();
  return useQuery({
    queryKey: keys.dayNotesRange(from, to),
    queryFn: () => dayNotes.datesWithNotes(from, to),
    enabled: signedIn && (enabled ?? true),
  });
}

function useInvalidateDayNotes() {
  const qc = useQueryClient();
  return (date?: DayKey) => {
    if (date) qc.invalidateQueries({ queryKey: keys.dayNotes(date) });
    else qc.invalidateQueries({ queryKey: ['day-notes'] });
    qc.invalidateQueries({ queryKey: ['day-notes-range'] });
  };
}

export function useAddDayNote() {
  const { dayNotes } = useRepos();
  const invalidate = useInvalidateDayNotes();
  return useMutation({
    mutationFn: (input: { date: DayKey; body: string }) => dayNotes.add(input.date, input.body),
    onSuccess: (_data, vars) => invalidate(vars.date),
  });
}

export function useUpdateDayNote() {
  const { dayNotes } = useRepos();
  const invalidate = useInvalidateDayNotes();
  return useMutation({
    mutationFn: (input: { id: string; date: DayKey; body: string }) =>
      dayNotes.update(input.id, input.body),
    onSuccess: (_data, vars) => invalidate(vars.date),
  });
}

export function useDeleteDayNote() {
  const { dayNotes } = useRepos();
  const invalidate = useInvalidateDayNotes();
  return useMutation({
    mutationFn: (input: { id: string; date: DayKey }) => dayNotes.remove(input.id),
    onSuccess: (_data, vars) => invalidate(vars.date),
  });
}

/** The signed-in user's own profile page. */
export function useMyProfile() {
  const { signedIn } = useAuth();
  const { profile } = useRepos();
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => profile.me(),
    enabled: signedIn,
  });
}

export function useMyProfilePosts() {
  const { signedIn } = useAuth();
  const { profile } = useRepos();
  return useQuery({
    queryKey: keys.profilePosts,
    queryFn: () => profile.myPosts(),
    enabled: signedIn,
  });
}

export function useFriendsFeed() {
  const { signedIn } = useAuth();
  const { profile } = useRepos();
  return useInfiniteQuery({
    queryKey: keys.friendsFeed,
    queryFn: ({ pageParam }) => profile.friendsFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.isDone ? undefined : lastPage.continueCursor),
    enabled: signedIn,
  });
}

/** Someone's profile by handle. Resolves to null when it is private or does
 * not exist, so a public page can be opened without a session. */
export function usePublicProfile(handle: string) {
  const { profile } = useRepos();
  return useQuery({
    queryKey: keys.publicProfile(handle),
    queryFn: () => profile.byHandle(handle),
    enabled: handle.length > 0,
  });
}

/** Anything that touches the profile also changes the header avatar and the
 * public page, so all three are dropped together. */
function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.profile });
    qc.invalidateQueries({ queryKey: keys.profilePosts });
    qc.invalidateQueries({ queryKey: keys.friendsFeed });
    qc.invalidateQueries({ queryKey: ['public-profile'] });
  };
}

export function useUpdateProfile() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => profile.update(patch),
    onSuccess: invalidate,
  });
}

/** Store a picked image, then point the avatar or banner at it. Passing no
 * file clears the image instead. */
export function useSetProfileImage() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (input: { kind: ProfileImageKind; file: Blob | null }) => {
      const storageId = input.file ? await profile.uploadImage(input.file) : null;
      return profile.setImage(input.kind, storageId);
    },
    onSuccess: invalidate,
  });
}

export function useAddProfilePost() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: async (input: { body: string; file?: Blob | null }) => {
      const imageId = input.file ? await profile.uploadImage(input.file) : undefined;
      return profile.addPost(input.body, imageId);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProfilePost() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) => profile.updatePost(input.id, input.body),
    onSuccess: invalidate,
  });
}

export function useDeleteProfilePost() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (id: string) => profile.removePost(id),
    onSuccess: invalidate,
  });
}

export function useSetProfileFollow() {
  const { profile } = useRepos();
  const invalidate = useInvalidateProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { handle?: string; userId?: string; follow: boolean }) =>
      input.userId
        ? profile.requestFriend(input.userId, input.follow)
        : profile.setFollow(input.handle ?? '', input.follow),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['chat-people'] });
      qc.invalidateQueries({ queryKey: keys.chats });
      qc.invalidateQueries({ queryKey: ['chat-thread'] });
      qc.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

function useInvalidatePhotos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.photos });
    qc.invalidateQueries({ queryKey: ['public-photos'] });
    qc.invalidateQueries({ queryKey: ['photo-thread'] });
  };
}

export function useMyPhotos() {
  const { signedIn } = useAuth();
  const { photos } = useRepos();
  return useQuery({
    queryKey: keys.photos,
    queryFn: () => photos.mine(),
    enabled: signedIn,
  });
}

export function usePublicPhotos(handle: string) {
  const { photos } = useRepos();
  return useQuery({
    queryKey: keys.publicPhotos(handle),
    queryFn: () => photos.forHandle(handle),
    enabled: handle.length > 0,
  });
}

export function useAddPhoto() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: async (input: { file: Blob; caption?: string; isPublic?: boolean }) => {
      const imageId = await photos.upload(input.file);
      return photos.add(imageId, input.caption, input.isPublic);
    },
    onSuccess: invalidate,
  });
}

export function useAddPhotos() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: async (input: { files: Blob[]; isPublic?: boolean }) => {
      const imageIds: string[] = [];
      for (const file of input.files) {
        imageIds.push(await photos.upload(file));
      }
      return photos.addMany(imageIds, input.isPublic);
    },
    onSuccess: invalidate,
  });
}

export function useSetPhotoPublic() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: (input: { id: string; isPublic: boolean }) =>
      photos.setPublic(input.id, input.isPublic),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: (id: string) => photos.remove(id),
    onSuccess: invalidate,
  });
}

export function usePhotoThread(id: string) {
  const { photos } = useRepos();
  return useQuery({
    queryKey: keys.photoThread(id),
    queryFn: () => photos.thread(id),
    enabled: id.length > 0,
  });
}

export function useSetPhotoLike() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: (input: { id: string; liked: boolean }) => photos.setLike(input.id, input.liked),
    onSuccess: invalidate,
  });
}

export function useAddPhotoComment() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) => photos.addComment(input.id, input.body),
    onSuccess: invalidate,
  });
}

export function useRemovePhotoComment() {
  const { photos } = useRepos();
  const invalidate = useInvalidatePhotos();
  return useMutation({
    mutationFn: (input: { photoId: string; id: string }) => photos.removeComment(input.id),
    onSuccess: invalidate,
  });
}

function useInvalidateGroups() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.groups });
    qc.invalidateQueries({ queryKey: keys.groupDiscovery });
    qc.invalidateQueries({ queryKey: ['public-groups'] });
  };
}

export function useMyGroups() {
  const { signedIn } = useAuth();
  const { groups } = useRepos();
  return useQuery({
    queryKey: keys.groups,
    queryFn: () => groups.mine(),
    enabled: signedIn,
  });
}

export function useGroupDiscovery() {
  const { signedIn } = useAuth();
  const { groups } = useRepos();
  return useQuery({
    queryKey: keys.groupDiscovery,
    queryFn: () => groups.discover(),
    enabled: signedIn,
  });
}

export function usePublicGroups(handle: string) {
  const { groups } = useRepos();
  return useQuery({
    queryKey: keys.publicGroups(handle),
    queryFn: () => groups.forHandle(handle),
    enabled: handle.length > 0,
  });
}

export function useCreateGroup() {
  const { groups } = useRepos();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (input: {
      name: string;
      sport?: string;
      location?: string;
      description?: string;
      isPublic?: boolean;
    }) => groups.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateGroup() {
  const { groups } = useRepos();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name: string;
      sport?: string;
      location?: string;
      description?: string;
      isPublic?: boolean;
    }) => groups.update(id, input),
    onSuccess: invalidate,
  });
}

export function useJoinGroup() {
  const { groups } = useRepos();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (id: string) => groups.join(id),
    onSuccess: invalidate,
  });
}

export function useLeaveGroup() {
  const { groups } = useRepos();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (id: string) => groups.leave(id),
    onSuccess: invalidate,
  });
}

export function useDeleteGroup() {
  const { groups } = useRepos();
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (id: string) => groups.remove(id),
    onSuccess: invalidate,
  });
}

function useInvalidateChats() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: keys.chats });
    if (id) qc.invalidateQueries({ queryKey: keys.chatThread(id) });
  };
}

export function useChats() {
  const { signedIn } = useAuth();
  const { chats } = useRepos();
  return useQuery({
    queryKey: keys.chats,
    queryFn: () => chats.list(),
    enabled: signedIn,
    refetchInterval: 10_000,
  });
}

export function useChatPeople(search: string, enabled = true) {
  const { signedIn } = useAuth();
  const { chats } = useRepos();
  return useQuery({
    queryKey: keys.chatPeople(search.trim().toLowerCase()),
    queryFn: () => chats.people(search),
    enabled: signedIn && enabled,
  });
}

export function useOpenChat() {
  const { chats } = useRepos();
  const invalidate = useInvalidateChats();
  return useMutation({
    mutationFn: (handle: string) => chats.open(handle),
    onSuccess: () => invalidate(),
  });
}

export function useChatThread(id: string) {
  const { signedIn } = useAuth();
  const { chats } = useRepos();
  return useQuery({
    queryKey: keys.chatThread(id),
    queryFn: () => chats.thread(id),
    enabled: signedIn && id.length > 0,
    refetchInterval: 3_000,
  });
}

export function useSendChatMessage() {
  const { chats } = useRepos();
  const invalidate = useInvalidateChats();
  return useMutation({
    mutationFn: async (input: { id: string; body: string; attachment?: PickedAttachment }) => {
      const picked = input.attachment;
      if (!picked) return chats.send(input.id, input.body);
      // Upload first: the message row is only written once its file exists,
      // so a failed upload never leaves an attachment-shaped hole in the thread.
      const mediaId = await chats.upload(picked.blob);
      return chats.send(input.id, input.body, {
        mediaId,
        kind: picked.kind,
        width: picked.width,
        height: picked.height,
      });
    },
    onSuccess: (_message, input) => invalidate(input.id),
  });
}

export function useMarkChatRead() {
  const { chats } = useRepos();
  const invalidate = useInvalidateChats();
  const invalidateNotifications = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => chats.markRead(id),
    onSuccess: (_nothing, id) => {
      invalidate(id);
      invalidateNotifications();
    },
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.notifications });
}

export function useNotifications() {
  const { signedIn } = useAuth();
  const { notifications } = useRepos();
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => notifications.list(),
    enabled: signedIn,
    refetchInterval: 5_000,
  });
}

export function useMarkNotificationRead() {
  const { notifications } = useRepos();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notifications.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const { notifications } = useRepos();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notifications.markAllRead(),
    onSuccess: invalidate,
  });
}

export function useFastingState() {
  const { signedIn } = useAuth();
  const { fasting } = useRepos();
  return useQuery({
    queryKey: keys.fasting,
    queryFn: () => fasting.state(),
    enabled: signedIn,
  });
}

function useInvalidateFasting() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.fasting });
}

export function useStartFast() {
  const { fasting } = useRepos();
  const invalidate = useInvalidateFasting();
  return useMutation({
    mutationFn: ({ startAt, endAt }: { startAt: number; endAt: number }) =>
      fasting.start(startAt, endAt),
    onSuccess: invalidate,
  });
}

export function useStopFast() {
  const { fasting } = useRepos();
  const invalidate = useInvalidateFasting();
  return useMutation({
    mutationFn: () => fasting.stop(),
    onSuccess: invalidate,
  });
}

export function useSaveFastingSlot() {
  const { fasting } = useRepos();
  const invalidate = useInvalidateFasting();
  return useMutation({
    mutationFn: ({ label, durationMinutes }: { label: string; durationMinutes: number }) =>
      fasting.saveSlot(label, durationMinutes),
    onSuccess: invalidate,
  });
}

export function useRemoveFastingSlot() {
  const { fasting } = useRepos();
  const invalidate = useInvalidateFasting();
  return useMutation({
    mutationFn: (id: string) => fasting.removeSlot(id),
    onSuccess: invalidate,
  });
}

export function useDiaryEntries(date: DayKey) {
  const { signedIn } = useAuth();
  const { diary } = useRepos();
  return useQuery({
    queryKey: keys.diary(date),
    queryFn: () => diary.entriesForDate(date),
    enabled: signedIn,
  });
}

/** Pass `enabled` to hold the fetch back while the screen asking is closed. */
export function useDiaryRange(from: DayKey, to: DayKey, enabled?: boolean) {
  const { signedIn } = useAuth();
  const { diary } = useRepos();
  return useQuery({
    queryKey: keys.diaryRange(from, to),
    queryFn: () => diary.entriesForRange(from, to),
    enabled: signedIn && (enabled ?? true),
  });
}

export function useActivityEntries(date: DayKey) {
  const { signedIn } = useAuth();
  const { activity } = useRepos();
  return useQuery({
    queryKey: keys.activity(date),
    queryFn: () => activity.entriesForDate(date),
    enabled: signedIn,
  });
}

export function useActivityRange(from: DayKey, to: DayKey) {
  const { signedIn } = useAuth();
  const { activity } = useRepos();
  return useQuery({
    queryKey: keys.activityRange(from, to),
    queryFn: () => activity.entriesForRange(from, to),
    enabled: signedIn,
  });
}

export function useGoalConfigs() {
  const { signedIn } = useAuth();
  const { goals } = useRepos();
  return useQuery({
    queryKey: keys.goals,
    queryFn: () => goals.listConfigs(),
    enabled: signedIn,
  });
}

export function useDayTypeMarks() {
  const { signedIn } = useAuth();
  const { goals } = useRepos();
  return useQuery({
    queryKey: keys.marks,
    queryFn: () => goals.allMarks(),
    enabled: signedIn,
  });
}

/** Settings live in the account, so a signed-out screen must not ask for
 * them. Defaults to the current session; pass a boolean to override. */
export function useSetting<T>(key: string, fallback: T, enabled?: boolean) {
  const { signedIn } = useAuth();
  const { settings } = useRepos();
  return useQuery({
    queryKey: keys.setting(key),
    queryFn: () => settings.get<T>(key, fallback),
    enabled: enabled ?? signedIn,
  });
}

export function useWeekStart(): WeekStart {
  return useSetting<WeekStart>('weekStart', 'monday').data ?? 'monday';
}

export function useTrainingSchedule(from: DayKey, to: DayKey) {
  const { signedIn } = useAuth();
  const { trainingSchedule } = useRepos();
  return useQuery({
    queryKey: keys.trainingSchedule(from, to),
    queryFn: () => trainingSchedule.range(from, to),
    enabled: signedIn,
  });
}

export function useTrainingScheduleRepeatDays() {
  const { signedIn } = useAuth();
  const { trainingSchedule } = useRepos();
  return useQuery({
    queryKey: keys.trainingScheduleRepeats,
    queryFn: () => trainingSchedule.repeatDays(),
    enabled: signedIn,
  });
}

function useInvalidateTrainingSchedule() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['training-schedule'] });
    void qc.invalidateQueries({ queryKey: keys.trainingScheduleRepeats });
  };
}

export function useSaveTrainingScheduleDay() {
  const { trainingSchedule } = useRepos();
  const invalidate = useInvalidateTrainingSchedule();
  return useMutation({
    mutationFn: (day: TrainingScheduleDayInput) => trainingSchedule.save(day),
    onSuccess: invalidate,
  });
}

export function useRemoveTrainingScheduleDay() {
  const { trainingSchedule } = useRepos();
  const invalidate = useInvalidateTrainingSchedule();
  return useMutation({
    mutationFn: (date: DayKey) => trainingSchedule.remove(date),
    onSuccess: invalidate,
  });
}

export function useSetTrainingScheduleRepeatDay() {
  const { trainingSchedule } = useRepos();
  const qc = useQueryClient();
  const invalidate = useInvalidateTrainingSchedule();
  return useMutation({
    mutationFn: ({ date, enabled }: { date: DayKey; enabled: boolean }) =>
      trainingSchedule.setRepeatDay(date, enabled),
    onMutate: async ({ date, enabled }) => {
      await qc.cancelQueries({ queryKey: keys.trainingScheduleRepeats });
      const previous = qc.getQueryData<number[]>(keys.trainingScheduleRepeats);
      const next = new Set(previous ?? []);
      if (enabled) next.add(weekdayOf(date));
      else next.delete(weekdayOf(date));
      qc.setQueryData(
        keys.trainingScheduleRepeats,
        [...next].sort((a, b) => a - b),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      qc.setQueryData(keys.trainingScheduleRepeats, context?.previous);
    },
    onSuccess: (repeatDays) => {
      qc.setQueryData(keys.trainingScheduleRepeats, repeatDays);
    },
    onSettled: invalidate,
  });
}

export function useSetAllTrainingScheduleRepeats() {
  const { trainingSchedule } = useRepos();
  const qc = useQueryClient();
  const invalidate = useInvalidateTrainingSchedule();
  return useMutation({
    mutationFn: ({ dates, enabled }: { dates: DayKey[]; enabled: boolean }) =>
      trainingSchedule.setRepeatAll(dates, enabled),
    onMutate: async ({ enabled }) => {
      await qc.cancelQueries({ queryKey: keys.trainingScheduleRepeats });
      const previous = qc.getQueryData<number[]>(keys.trainingScheduleRepeats);
      qc.setQueryData(keys.trainingScheduleRepeats, enabled ? [0, 1, 2, 3, 4, 5, 6] : []);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      qc.setQueryData(keys.trainingScheduleRepeats, context?.previous);
    },
    onSuccess: (repeatDays) => {
      qc.setQueryData(keys.trainingScheduleRepeats, repeatDays);
    },
    onSettled: invalidate,
  });
}

export function useMealCategories() {
  const { signedIn } = useAuth();
  const { settings } = useRepos();
  const query = useQuery({
    queryKey: keys.mealCategories,
    queryFn: () => settings.getMealCategories(),
    enabled: signedIn,
  });
  return { ...query, data: query.data ?? (signedIn ? undefined : GUEST_MEALS) };
}

/** Add a diary entry + record history, invalidating all totals. */
export function useAddDiaryEntry() {
  const { diary, history } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: async (input: { entry: NewDiaryEntry; foodKey?: string }) => {
      const added = await diary.add(input.entry);
      if (input.foodKey) {
        await history.recordLog(
          input.foodKey,
          input.entry.name,
          input.entry.meal,
          input.entry.imageUrl,
        );
      }
      return added;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateDiaryEntry() {
  const { diary } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewDiaryEntry> }) =>
      diary.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteDiaryEntries() {
  const { diary } = useRepos();
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: (ids: string[]) => diary.removeMany(ids),
    onSuccess: invalidate,
  });
}

export function useAddActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: (entry: NewActivityEntry) => activity.add(entry),
    onSuccess: invalidate,
  });
}

export function useUpdateActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewActivityEntry> }) =>
      activity.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteActivityEntry() {
  const { activity } = useRepos();
  const invalidate = useInvalidateActivity();
  return useMutation({
    mutationFn: (id: string) => activity.remove(id),
    onSuccess: invalidate,
  });
}

/** Compute a day's progress from food + activity burn + the goal in effect. */
export function useDayProgress(date: DayKey): DayProgress | null {
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();
  if (!entries.data || !activities.data || !configs.data || !marks.data) return null;
  const config = pickConfig(date, configs.data);
  if (!config) return null;
  const burned = activities.data.reduce((sum, a) => sum + a.caloriesBurned, 0);
  return dayProgress(
    date,
    entries.data.map((e: DiaryEntry) => e.nutrition),
    config,
    marks.data,
    burned,
  );
}

/** Training or rest for a date, under the goal config in effect then. */
export function useDayType(date: DayKey): DayType | null {
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();
  if (!configs.data || !marks.data) return null;
  const config = pickConfig(date, configs.data);
  if (!config) return null;
  return classifyDay(date, config, marks.data);
}

/** Compute weekly progress for the week containing `date`. */
export function useWeekProgress(date: DayKey): WeekProgress | null {
  const weekStart = useWeekStart();
  const days = weekDays(date, weekStart);
  const range = useDiaryRange(days[0], days[6]);
  const activityRange = useActivityRange(days[0], days[6]);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();
  if (!range.data || !activityRange.data || !configs.data || !marks.data) return null;
  const config = pickConfig(date, configs.data);
  if (!config) return null;
  const byDay: Record<DayKey, { calories: number }[]> = {};
  for (const e of range.data) {
    (byDay[e.date] ??= []).push(e.nutrition);
  }
  const burnedByDay: Record<DayKey, number> = {};
  for (const a of activityRange.data) {
    burnedByDay[a.date] = (burnedByDay[a.date] ?? 0) + a.caloriesBurned;
  }
  return weekProgress(days, byDay, config, marks.data, burnedByDay);
}

function pickConfig(date: DayKey, configs: GoalConfig[]): GoalConfig | null {
  if (configs.length === 0) return null;
  let chosen = configs[0];
  for (const c of configs) {
    if (c.effectiveFrom <= date) chosen = c;
    else break;
  }
  return chosen;
}
