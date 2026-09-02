import { newId } from './auth';

export interface CollectionItemInput {
  name: string;
  quantity: number;
  unit: string;
  nutrition: { calories: number } & Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
}

/** Saved meals and recipes share one shape: a named parent with servings and
 * an ordered list of items. Items get fresh ids and positions on every write,
 * matching the previous "replace all items" semantics. */
export function buildItems<T extends CollectionItemInput>(items: T[]) {
  return items.map((it, position) => ({
    id: newId(),
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    nutrition: it.nutrition,
    sourceType: it.sourceType,
    sourceId: it.sourceId,
    position,
  }));
}

export function validateCollection(name: string, servings: number): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name is required');
  if (servings <= 0) throw new Error('Servings must be positive');
  return trimmed;
}
