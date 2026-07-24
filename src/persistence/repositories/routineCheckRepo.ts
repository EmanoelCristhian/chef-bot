import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "src/persistence/db.js";
import type { LlmProvider, RoutineCheckStatus, VerificationType } from "src/domain/types.js";
import { count, routineCheck, supply } from "src/persistence/schema.js";
import { effectiveValue } from "src/calculation/expected.js";

export interface NewRoutineCheck {
  routineId: string;
  storeId: string;
  supplyId: string | null;
  verificationType: VerificationType;
  status: RoutineCheckStatus;
  collaboratorTelegramId: string;
  confirmedByTelegramId: string | null;
  rawText: string;
  llmUsed?: LlmProvider;
  createdAt?: Date;
  payload?: unknown;
}

export interface PendingMismatchRow {
  routineCheckId: string;
  supplyCode: string;
  supplyName: string;
  reportedValue: number;
  expectedValue: number;
  difference: number;
  createdAt: Date;
}

export async function insert(db: Db, data: NewRoutineCheck) {
  const [created] = await db
    .insert(routineCheck)
    .values({
      routineId: data.routineId,
      storeId: data.storeId,
      supplyId: data.supplyId,
      verificationType: data.verificationType,
      status: data.status,
      collaboratorTelegramId: data.collaboratorTelegramId,
      confirmedByTelegramId: data.confirmedByTelegramId,
      rawText: data.rawText,
      llmUsed: data.llmUsed ?? "claude",
      payload: data.payload ?? null,
      ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
    })
    .returning();
  if (!created) {
    throw new Error("Failed to insert routine_check.");
  }
  return created;
}

export async function findById(db: Db, id: string) {
  const [found] = await db.select().from(routineCheck).where(eq(routineCheck.id, id)).limit(1);
  return found ?? null;
}

/**
 * Write-once accept. Returns the updated row, or null if already accepted / missing.
 */
export async function acceptIfPending(
  db: Db,
  routineCheckId: string,
  acceptedByTelegramId: string,
): Promise<(typeof routineCheck.$inferSelect) | null> {
  const [updated] = await db
    .update(routineCheck)
    .set({
      status: "accepted",
      acceptedByTelegramId,
      acceptedAt: new Date(),
    })
    .where(and(eq(routineCheck.id, routineCheckId), isNull(routineCheck.acceptedAt)))
    .returning();
  return updated ?? null;
}

/**
 * "Pendente" for the user = mismatched AND not yet accepted (no new status enum).
 * Ordered oldest-first so the numbered list is stable for the selection snapshot.
 */
export async function findPendingMismatchesByStore(db: Db, storeId: string): Promise<PendingMismatchRow[]> {
  const rows = await db
    .select({
      routineCheckId: routineCheck.id,
      supplyCode: supply.code,
      supplyName: supply.name,
      reportedValue: count.reportedValue,
      actualQuantityReported: count.actualQuantityReported,
      expectedValue: count.expectedValue,
      createdAt: routineCheck.createdAt,
    })
    .from(routineCheck)
    .innerJoin(count, eq(count.routineCheckId, routineCheck.id))
    .innerJoin(supply, eq(supply.id, routineCheck.supplyId))
    .where(
      and(
        eq(routineCheck.storeId, storeId),
        eq(routineCheck.status, "mismatched"),
        isNull(routineCheck.acceptedAt),
      ),
    )
    .orderBy(asc(routineCheck.createdAt));

  return rows.map((row) => {
    const reportedValue = effectiveValue({
      reportedValue: row.reportedValue,
      actualQuantityReported: row.actualQuantityReported,
    });
    return {
      routineCheckId: row.routineCheckId,
      supplyCode: row.supplyCode,
      supplyName: row.supplyName,
      reportedValue,
      expectedValue: row.expectedValue,
      difference: reportedValue - row.expectedValue,
      createdAt: row.createdAt,
    };
  });
}
