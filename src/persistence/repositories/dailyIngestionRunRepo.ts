import { and, eq } from "drizzle-orm";
import type { Db } from "src/persistence/db.js";
import { dailyIngestionRun } from "src/persistence/schema.js";

export async function hasRunForDate(db: Db, storeId: string, date: string): Promise<boolean> {
  const [found] = await db
    .select()
    .from(dailyIngestionRun)
    .where(and(eq(dailyIngestionRun.storeId, storeId), eq(dailyIngestionRun.date, date)))
    .limit(1);
  return Boolean(found);
}

// Idempotent by design (unique(storeId, date)) — re-running /ingest-xml for the same
// day is a normal retry (D11: no scheduler, someone re-triggers by hand), not an error.
export async function recordRun(db: Db, storeId: string, date: string): Promise<void> {
  await db.insert(dailyIngestionRun).values({ storeId, date }).onConflictDoNothing();
}
