import { Database } from '../driver';

/** Adds product-image columns so diary rows and recent/frequent lists can
 * show the food's image (snapshotted at log time, like nutrition). */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    ALTER TABLE diary_entries ADD COLUMN image_url TEXT;
    ALTER TABLE food_log_history ADD COLUMN image_url TEXT;
  `);
}
