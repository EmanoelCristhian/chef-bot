import { eq } from "drizzle-orm";
import type { Db } from "src/persistence/db.js";
import { pendingMismatchSelection } from "src/persistence/schema.js";

/** How long a /confirma_contagem numbered list stays valid for a chat. */
export const MISMATCH_SELECTION_TTL_MS = 15 * 60 * 1000;

export async function upsertForChat(
  db: Db,
  data: { chatId: string; storeId: string; routineCheckIds: string[] },
) {
  const [created] = await db
    .insert(pendingMismatchSelection)
    .values({
      chatId: data.chatId,
      storeId: data.storeId,
      routineCheckIds: data.routineCheckIds,
    })
    .onConflictDoUpdate({
      target: pendingMismatchSelection.chatId,
      set: {
        storeId: data.storeId,
        routineCheckIds: data.routineCheckIds,
        createdAt: new Date(),
      },
    })
    .returning();
  if (!created) {
    throw new Error("Failed to upsert pending_mismatch_selection.");
  }
  return created;
}

export async function findByChatId(db: Db, chatId: string) {
  const [found] = await db
    .select()
    .from(pendingMismatchSelection)
    .where(eq(pendingMismatchSelection.chatId, chatId))
    .limit(1);
  return found ?? null;
}

export async function deleteByChatId(db: Db, chatId: string): Promise<void> {
  await db.delete(pendingMismatchSelection).where(eq(pendingMismatchSelection.chatId, chatId));
}

export function isSelectionExpired(
  selection: { createdAt: Date },
  now: Date = new Date(),
  ttlMs: number = MISMATCH_SELECTION_TTL_MS,
): boolean {
  return now.getTime() - selection.createdAt.getTime() > ttlMs;
}
