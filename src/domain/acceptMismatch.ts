import type { Db } from "src/persistence/db.js";
import * as supplyRepo from "src/persistence/repositories/supplyRepo.js";
import * as countRepo from "src/persistence/repositories/countRepo.js";
import * as routineCheckRepo from "src/persistence/repositories/routineCheckRepo.js";
import type { PendingMismatchRow } from "src/persistence/repositories/routineCheckRepo.js";
import { effectiveValue } from "src/calculation/expected.js";

export type AcceptMismatchResult =
  | {
      ok: true;
      supplyCode: string;
      supplyName: string;
      reportedValue: number;
      expectedValue: number;
      difference: number;
    }
  | {
      ok: false;
      reason: "not_found" | "already_accepted" | "not_pending";
    };

/**
 * Accept one pending mismatch by routine_check id (write-once via acceptIfPending).
 * Used after the collaborator picks a number from /confirma_contagem.
 */
export async function acceptMismatchByRoutineCheckId(
  db: Db,
  params: { routineCheckId: string; acceptedByTelegramId: string },
): Promise<AcceptMismatchResult> {
  const check = await routineCheckRepo.findById(db, params.routineCheckId);
  if (!check) {
    return { ok: false, reason: "not_found" };
  }
  if (check.acceptedAt) {
    return { ok: false, reason: "already_accepted" };
  }
  if (check.status !== "mismatched") {
    return { ok: false, reason: "not_pending" };
  }

  const countRow = await countRepo.findByRoutineCheckId(db, check.id);
  if (!countRow) {
    return { ok: false, reason: "not_found" };
  }

  const updated = await routineCheckRepo.acceptIfPending(db, check.id, params.acceptedByTelegramId);
  if (!updated) {
    return { ok: false, reason: "already_accepted" };
  }

  const supplyFound = check.supplyId ? await supplyRepo.findById(db, check.supplyId) : null;
  const reportedValue = effectiveValue({
    reportedValue: countRow.reportedValue,
    actualQuantityReported: countRow.actualQuantityReported,
  });

  return {
    ok: true,
    supplyCode: supplyFound?.code ?? "?",
    supplyName: supplyFound?.name ?? "Insumo",
    reportedValue,
    expectedValue: countRow.expectedValue,
    difference: reportedValue - countRow.expectedValue,
  };
}

export function formatSignedDifference(difference: number): string {
  return difference > 0 ? `+${difference}` : String(difference);
}

export function formatPendingMismatchList(items: PendingMismatchRow[]): string {
  const header = "Contagens pendentes de confirmação:\n";
  const lines = items.map((item, index) => {
    const diff = formatSignedDifference(item.difference);
    return (
      `${index + 1}. ${item.supplyName} (${item.supplyCode}) — ` +
      `informado: ${item.reportedValue} | esperado: ${item.expectedValue} | diferença: ${diff}`
    );
  });
  const footer = "\n\nResponda com o número da linha para aceitar como estoque real.";
  return header + lines.join("\n") + footer;
}

export function formatAcceptReply(result: AcceptMismatchResult): string {
  if (!result.ok) {
    if (result.reason === "already_accepted") {
      return "Essa divergência já foi aceita.";
    }
    if (result.reason === "not_pending") {
      return "Essa contagem não está mais pendente de confirmação.";
    }
    return "Não encontrei essa contagem pendente.";
  }

  const diff = formatSignedDifference(result.difference);
  return (
    `✅ Divergência de ${result.supplyName} (${result.supplyCode}) aceita como estoque real.\n` +
    `informado: ${result.reportedValue} | esperado: ${result.expectedValue} | diferença: ${diff}`
  );
}

export { type PendingMismatchRow };
