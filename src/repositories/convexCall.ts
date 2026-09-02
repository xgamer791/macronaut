import type { ConvexCaller } from '@/services/convex/client';

export type { ConvexCaller };

/** Convex rejects `undefined` anywhere inside function arguments, while the
 * app freely builds objects with optional fields left undefined. A JSON round
 * trip drops those keys (and nothing else the app sends: plain data only). */
export function clean<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
