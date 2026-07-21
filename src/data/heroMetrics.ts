import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Metrics that can appear in Today hero modules. */
export type HeroMetricId =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'water'
  | 'steps'
  | 'burned';

export type HeroMetricKind = 'ring' | 'macro' | 'steps' | 'water' | 'burned';

export interface HeroMetricDef {
  id: HeroMetricId;
  label: string;
  /** Short picker subtitle describing the optimal module treatment. */
  subtitle: string;
  kind: HeroMetricKind;
  unit: string;
  icon: IonName;
}

/** Catalog shown in the module picker — everything trackable in-app. */
export const HERO_METRICS: HeroMetricDef[] = [
  {
    id: 'calories',
    label: 'Calories',
    subtitle: 'Ring — remaining toward goal',
    kind: 'ring',
    unit: 'kcal',
    icon: 'flame-outline',
  },
  {
    id: 'protein',
    label: 'Protein',
    subtitle: 'Ring — grams remaining toward goal',
    kind: 'ring',
    unit: 'g',
    icon: 'fish-outline',
  },
  {
    id: 'carbs',
    label: 'Carbs',
    subtitle: 'Ring — grams remaining toward goal',
    kind: 'ring',
    unit: 'g',
    icon: 'nutrition-outline',
  },
  {
    id: 'fat',
    label: 'Fat',
    subtitle: 'Ring — grams remaining toward goal',
    kind: 'ring',
    unit: 'g',
    icon: 'water-outline',
  },
  {
    id: 'fiber',
    label: 'Fiber',
    subtitle: 'Macro bar — grams vs goal',
    kind: 'macro',
    unit: 'g',
    icon: 'leaf-outline',
  },
  {
    id: 'water',
    label: 'Water',
    subtitle: 'Cup grid — intake vs goal',
    kind: 'water',
    unit: 'cups',
    icon: 'water',
  },
  {
    id: 'steps',
    label: 'Steps',
    subtitle: 'Stride meter — count vs goal',
    kind: 'steps',
    unit: 'steps',
    icon: 'walk-outline',
  },
  {
    id: 'burned',
    label: 'Calories burned',
    subtitle: 'Burn card — exercise kcal',
    kind: 'burned',
    unit: 'kcal',
    icon: 'flash-outline',
  },
];

export const HERO_METRIC_IDS = HERO_METRICS.map((m) => m.id);

export function isHeroMetricId(value: unknown): value is HeroMetricId {
  return typeof value === 'string' && (HERO_METRIC_IDS as string[]).includes(value);
}

export function heroMetricDef(id: HeroMetricId): HeroMetricDef {
  return HERO_METRICS.find((m) => m.id === id) ?? HERO_METRICS[0];
}

export const DEFAULT_HERO_LEFT: HeroMetricId = 'calories';
export const DEFAULT_HERO_RIGHT: HeroMetricId = 'steps';
