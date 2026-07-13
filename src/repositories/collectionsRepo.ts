import { Database } from '@/db/driver';
import { Nutrition } from '@/domain/types';
import { sumNutrition, scaleNutrition } from '@/domain/nutrition';
import { Recipe, RecipeIngredient, SavedMeal, SavedMealItem } from './types';
import { newId, nowIso, safeParse } from './util';

/** Saved meals and recipes share the same parent+items shape; this factory
 * builds a repo for either pair of tables. */
interface ParentRow {
  id: string;
  name: string;
  image_url: string | null;
  servings: number;
  notes: string | null;
  favorite: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  nutrition: string;
  source_type: string | null;
  source_id: string | null;
  position: number;
}

export interface CollectionItemInput {
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  sourceType?: string;
  sourceId?: string;
}

export interface CollectionInput {
  name: string;
  imageUrl?: string;
  servings: number;
  notes?: string;
  items: CollectionItemInput[];
}

export interface CollectionRepo<T extends SavedMeal | Recipe> {
  list(query?: string): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: CollectionInput): Promise<T>;
  update(id: string, input: Partial<CollectionInput>): Promise<T>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<T>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  /** Total nutrition across all items. */
  totalNutrition(entity: T): Nutrition;
  /** Nutrition for one serving (total ÷ servings). */
  perServing(entity: T): Nutrition;
}

function createCollectionRepo<T extends SavedMeal | Recipe>(
  db: Database,
  parentTable: 'saved_meals' | 'recipes',
  itemTable: 'saved_meal_items' | 'recipe_ingredients',
  parentFk: 'meal_id' | 'recipe_id',
  itemsField: 'items' | 'ingredients',
): CollectionRepo<T> {
  async function loadItems(parentId: string): Promise<(SavedMealItem | RecipeIngredient)[]> {
    const rows = await db.getAllAsync<ItemRow>(
      `SELECT id, name, quantity, unit, nutrition, source_type, source_id, position
       FROM ${itemTable} WHERE ${parentFk} = ? ORDER BY position`,
      [parentId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      nutrition: safeParse<Nutrition>(r.nutrition, { calories: 0 }),
      sourceType: r.source_type ?? undefined,
      sourceId: r.source_id ?? undefined,
      position: r.position,
    }));
  }

  async function hydrate(row: ParentRow): Promise<T> {
    const items = await loadItems(row.id);
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.image_url ?? undefined,
      servings: row.servings,
      notes: row.notes ?? undefined,
      favorite: row.favorite === 1,
      [itemsField]: items,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as unknown as T;
  }

  async function writeItems(parentId: string, items: CollectionItemInput[]): Promise<void> {
    await db.runAsync(`DELETE FROM ${itemTable} WHERE ${parentFk} = ?`, [parentId]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.runAsync(
        `INSERT INTO ${itemTable} (id, ${parentFk}, name, quantity, unit, nutrition, source_type, source_id, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          parentId,
          it.name,
          it.quantity,
          it.unit,
          JSON.stringify(it.nutrition),
          it.sourceType ?? null,
          it.sourceId ?? null,
          i,
        ],
      );
    }
  }

  const SELECT = `SELECT id, name, image_url, servings, notes, favorite, created_at, updated_at
    FROM ${parentTable}`;

  function itemsOf(entity: T): (SavedMealItem | RecipeIngredient)[] {
    return (entity as unknown as Record<string, (SavedMealItem | RecipeIngredient)[]>)[itemsField];
  }

  return {
    async list(query) {
      const rows = query
        ? await db.getAllAsync<ParentRow>(
            `${SELECT} WHERE deleted = 0 AND name LIKE ? ORDER BY name`,
            [`%${query}%`],
          )
        : await db.getAllAsync<ParentRow>(`${SELECT} WHERE deleted = 0 ORDER BY name`);
      return Promise.all(rows.map(hydrate));
    },

    async get(id) {
      const row = await db.getFirstAsync<ParentRow>(`${SELECT} WHERE id = ? AND deleted = 0`, [id]);
      return row ? hydrate(row) : null;
    },

    async create(input) {
      if (!input.name.trim()) throw new Error('Name is required');
      if (input.servings <= 0) throw new Error('Servings must be positive');
      const id = newId();
      const now = nowIso();
      await db.withTransaction(async () => {
        await db.runAsync(
          `INSERT INTO ${parentTable} (id, name, image_url, servings, notes, favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [id, input.name.trim(), input.imageUrl ?? null, input.servings, input.notes ?? null, now, now],
        );
        await writeItems(id, input.items);
      });
      return (await this.get(id))!;
    },

    async update(id, input) {
      const existing = await this.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      const name = input.name ?? existing.name;
      if (!name.trim()) throw new Error('Name is required');
      const servings = input.servings ?? existing.servings;
      if (servings <= 0) throw new Error('Servings must be positive');
      await db.withTransaction(async () => {
        await db.runAsync(
          `UPDATE ${parentTable} SET name=?, image_url=?, servings=?, notes=?, updated_at=? WHERE id=?`,
          [
            name.trim(),
            input.imageUrl !== undefined ? (input.imageUrl ?? null) : (existing.imageUrl ?? null),
            servings,
            input.notes !== undefined ? (input.notes ?? null) : (existing.notes ?? null),
            nowIso(),
            id,
          ],
        );
        if (input.items) await writeItems(id, input.items);
      });
      return (await this.get(id))!;
    },

    async remove(id) {
      await db.runAsync(`UPDATE ${parentTable} SET deleted = 1, updated_at = ? WHERE id = ?`, [
        nowIso(),
        id,
      ]);
    },

    async duplicate(id) {
      const existing = await this.get(id);
      if (!existing) throw new Error(`Not found: ${id}`);
      return this.create({
        name: `${existing.name} (copy)`,
        imageUrl: existing.imageUrl,
        servings: existing.servings,
        notes: existing.notes,
        items: itemsOf(existing).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          nutrition: it.nutrition,
          sourceType: it.sourceType,
          sourceId: it.sourceId,
        })),
      });
    },

    async setFavorite(id, favorite) {
      await db.runAsync(`UPDATE ${parentTable} SET favorite = ?, updated_at = ? WHERE id = ?`, [
        favorite ? 1 : 0,
        nowIso(),
        id,
      ]);
    },

    totalNutrition(entity) {
      return sumNutrition(itemsOf(entity).map((i) => i.nutrition));
    },

    perServing(entity) {
      const total = this.totalNutrition(entity);
      return entity.servings > 0 ? scaleNutrition(total, 1 / entity.servings) : total;
    },
  };
}

export type SavedMealRepo = CollectionRepo<SavedMeal>;
export type RecipeRepo = CollectionRepo<Recipe>;

export function createSavedMealRepo(db: Database): SavedMealRepo {
  return createCollectionRepo<SavedMeal>(db, 'saved_meals', 'saved_meal_items', 'meal_id', 'items');
}

export function createRecipeRepo(db: Database): RecipeRepo {
  return createCollectionRepo<Recipe>(
    db,
    'recipes',
    'recipe_ingredients',
    'recipe_id',
    'ingredients',
  );
}
