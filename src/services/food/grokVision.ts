import { Nutrition } from '@/domain/types';
import { ServingUnit } from '@/domain/serving';

/** Client-side shape of a Grok food estimate. The scan itself runs on Convex. */
export interface GrokFoodEstimate {
  name: string;
  brand?: string;
  servingQty: number;
  servingUnit: ServingUnit | string;
  gramsPerServing?: number;
  nutrition: Nutrition;
  /** 0..1 model confidence. */
  confidence: number;
  notes?: string;
}
