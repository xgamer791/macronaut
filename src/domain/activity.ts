/** Shared activity taxonomy + presets for logging and Today shortcuts. */

import { ActivityType } from '@/repositories/types';

export interface ActivityCategory {
  id: ActivityType;
  name: string;
  icon: 'heart-outline' | 'barbell-outline' | 'football-outline' | 'body-outline' | 'fitness-outline';
  blurb: string;
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: 'cardio', name: 'Cardio', icon: 'heart-outline', blurb: 'Runs, rides, walks, HIIT' },
  { id: 'strength', name: 'Strength', icon: 'barbell-outline', blurb: 'Weights & resistance' },
  { id: 'sports', name: 'Sports', icon: 'football-outline', blurb: 'Games & recreation' },
  { id: 'mobility', name: 'Mobility', icon: 'body-outline', blurb: 'Yoga, stretch, recovery' },
];

export interface ActivityPreset {
  name: string;
  activityType: ActivityType;
  /** Rough kcal burned per minute — used only as a starting estimate. */
  kcalPerMin: number;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { name: 'Running', activityType: 'cardio', kcalPerMin: 11 },
  { name: 'Walking', activityType: 'cardio', kcalPerMin: 4 },
  { name: 'Cycling', activityType: 'cardio', kcalPerMin: 8 },
  { name: 'HIIT', activityType: 'cardio', kcalPerMin: 12 },
  { name: 'Swimming', activityType: 'cardio', kcalPerMin: 10 },
  { name: 'Weight training', activityType: 'strength', kcalPerMin: 6 },
  { name: 'Circuit training', activityType: 'strength', kcalPerMin: 8 },
  { name: 'Basketball', activityType: 'sports', kcalPerMin: 9 },
  { name: 'Soccer', activityType: 'sports', kcalPerMin: 10 },
  { name: 'Yoga', activityType: 'mobility', kcalPerMin: 3 },
  { name: 'Stretching', activityType: 'mobility', kcalPerMin: 2.5 },
];

export function estimateBurn(kcalPerMin: number, durationMin: number): number {
  if (!Number.isFinite(kcalPerMin) || !Number.isFinite(durationMin) || durationMin <= 0) return 0;
  return Math.round(kcalPerMin * durationMin);
}

export interface ActivityImprovement {
  kind: 'duration' | 'distance' | 'pace' | 'burn';
  label: string;
  detail: string;
}

/** Compare a new session against the most recent prior session of the same name. */
export function computeImprovements(
  current: {
    durationMin?: number;
    distanceKm?: number;
    caloriesBurned: number;
  },
  previous: {
    durationMin?: number;
    distanceKm?: number;
    caloriesBurned: number;
  } | null,
): ActivityImprovement[] {
  if (!previous) return [];
  const out: ActivityImprovement[] = [];

  if (
    current.durationMin !== undefined &&
    previous.durationMin !== undefined &&
    current.durationMin > 0 &&
    previous.durationMin > 0 &&
    current.distanceKm &&
    previous.distanceKm &&
    Math.abs(current.distanceKm - previous.distanceKm) < 0.35
  ) {
    const delta = previous.durationMin - current.durationMin;
    if (delta >= 0.5) {
      out.push({
        kind: 'pace',
        label: `${delta.toFixed(1)} min faster`,
        detail: `Last similar effort: ${previous.durationMin} min`,
      });
    }
  } else if (
    current.durationMin !== undefined &&
    previous.durationMin !== undefined &&
    current.durationMin > previous.durationMin + 0.5
  ) {
    const delta = current.durationMin - previous.durationMin;
    out.push({
      kind: 'duration',
      label: `+${delta.toFixed(0)} min longer`,
      detail: `Previous: ${previous.durationMin} min`,
    });
  }

  if (
    current.distanceKm !== undefined &&
    previous.distanceKm !== undefined &&
    current.distanceKm > previous.distanceKm + 0.1
  ) {
    const delta = current.distanceKm - previous.distanceKm;
    out.push({
      kind: 'distance',
      label: `+${delta.toFixed(1)} km farther`,
      detail: `Previous: ${previous.distanceKm.toFixed(1)} km`,
    });
  }

  if (current.caloriesBurned > previous.caloriesBurned + 15) {
    const delta = Math.round(current.caloriesBurned - previous.caloriesBurned);
    out.push({
      kind: 'burn',
      label: `+${delta} kcal burned`,
      detail: `Previous: ${Math.round(previous.caloriesBurned)} kcal`,
    });
  }

  return out;
}
