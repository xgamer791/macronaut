import { Database } from '../driver';

const SNACK_IDS = ['morning-snack', 'afternoon-snack', 'evening-snack'] as const;

/**
 * Collapse the six built-in meals into Breakfast · Lunch · Dinner · Snacks.
 * Remaps diary + history rows that pointed at the old snack slots.
 */
export async function up(db: Database): Promise<void> {
  // Ensure the unified snacks category exists.
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM meal_categories WHERE id = 'snacks'`,
  );
  if (!existing) {
    await db.runAsync(
      `INSERT INTO meal_categories (id, name, position, builtin, deleted)
       VALUES ('snacks', 'Snacks', 3, 1, 0)`,
    );
  } else {
    await db.runAsync(
      `UPDATE meal_categories
       SET name = 'Snacks', builtin = 1, deleted = 0, position = 3
       WHERE id = 'snacks'`,
    );
  }

  // Remap entries that used the old snack slots.
  for (const id of SNACK_IDS) {
    await db.runAsync(`UPDATE diary_entries SET meal = 'snacks' WHERE meal = ?`, [id]);
    await db.runAsync(`UPDATE food_log_history SET meal = 'snacks' WHERE meal = ?`, [id]);
  }

  // Soft-delete legacy snack categories (keep ids for any stray references).
  for (const id of SNACK_IDS) {
    await db.runAsync(`UPDATE meal_categories SET deleted = 1 WHERE id = ?`, [id]);
  }

  // Canonical order for the four built-ins.
  const order: [string, string, number][] = [
    ['breakfast', 'Breakfast', 0],
    ['lunch', 'Lunch', 1],
    ['dinner', 'Dinner', 2],
    ['snacks', 'Snacks', 3],
  ];
  for (const [id, name, position] of order) {
    await db.runAsync(
      `UPDATE meal_categories
       SET name = ?, position = ?, builtin = 1, deleted = 0
       WHERE id = ?`,
      [name, position, id],
    );
  }
}
