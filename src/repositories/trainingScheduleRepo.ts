import { api } from '../../convex/_generated/api';
import type { DayKey } from '@/utils/date';
import { clean, type ConvexCaller } from './convexCall';

export interface ScheduledWorkout {
  id: string;
  /** Athlete-authored name: exercise, drill, session, route, recovery work, etc. */
  label: string;
  /** A second free-form category or focus label. */
  macroLabel?: string;
  /** Optional because sets are not meaningful for every sport. */
  sets?: number;
}

export interface TrainingScheduleDay {
  id: string;
  date: DayKey;
  label: string;
  notes?: string;
  workouts: ScheduledWorkout[];
  createdAt: string;
  updatedAt: string;
}

export type TrainingScheduleDayInput = Pick<
  TrainingScheduleDay,
  'date' | 'label' | 'notes' | 'workouts'
>;

export interface TrainingScheduleRepo {
  range(from: DayKey, to: DayKey): Promise<TrainingScheduleDay[]>;
  repeatDays(): Promise<number[]>;
  save(day: TrainingScheduleDayInput): Promise<TrainingScheduleDay>;
  setRepeatDay(date: DayKey, enabled: boolean): Promise<number[]>;
  setRepeatAll(dates: DayKey[], enabled: boolean): Promise<number[]>;
  remove(date: DayKey): Promise<void>;
}

export function createTrainingScheduleRepo(convex: ConvexCaller): TrainingScheduleRepo {
  return {
    range: (from, to) => convex.query(api.trainingSchedule.range, { from, to }),
    repeatDays: () => convex.query(api.trainingSchedule.repeatDays, {}),
    save: (day) => convex.mutation(api.trainingSchedule.save, clean(day)),
    setRepeatDay: (date, enabled) =>
      convex.mutation(api.trainingSchedule.setRepeatDay, { date, enabled }),
    setRepeatAll: (dates, enabled) =>
      convex.mutation(api.trainingSchedule.setRepeatAll, { dates, enabled }),
    async remove(date) {
      await convex.mutation(api.trainingSchedule.remove, { date });
    },
  };
}
