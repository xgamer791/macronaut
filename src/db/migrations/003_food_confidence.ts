import { Database } from '../driver';

/** Cache-quality metadata: a confidence score, the resolved serving basis,
 * and whether the user corrected it. Low-confidence or corrected records are
 * re-queried live instead of being trusted forever. */
export async function up(db: Database): Promise<void> {
  await db.execAsync(`
    ALTER TABLE cached_foods ADD COLUMN confidence REAL;
    ALTER TABLE cached_foods ADD COLUMN serving_basis TEXT;
    ALTER TABLE cached_foods ADD COLUMN corrected INTEGER NOT NULL DEFAULT 0;
  `);
}
