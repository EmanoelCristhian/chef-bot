import { describe, expect, it } from "vitest";
import {
  formatAcceptReply,
  formatPendingMismatchList,
  type AcceptMismatchResult,
} from "src/domain/acceptMismatch.js";
import type { PendingMismatchRow } from "src/persistence/repositories/routineCheckRepo.js";

describe("formatAcceptReply", () => {
  it("includes informed/expected/difference on success", () => {
    const result: AcceptMismatchResult = {
      ok: true,
      supplyCode: "F",
      supplyName: "Burger F",
      reportedValue: 99,
      expectedValue: 100,
      difference: -1,
    };
    const text = formatAcceptReply(result);
    expect(text).toContain("informado: 99");
    expect(text).toContain("esperado: 100");
    expect(text).toContain("diferença: -1");
  });

  it("reports already accepted", () => {
    expect(formatAcceptReply({ ok: false, reason: "already_accepted" })).toContain("já foi aceita");
  });
});

describe("formatPendingMismatchList", () => {
  it("numbers each pending mismatch with informed/expected/difference", () => {
    const items: PendingMismatchRow[] = [
      {
        routineCheckId: "a",
        supplyCode: "F",
        supplyName: "Burger F",
        reportedValue: 99,
        expectedValue: 100,
        difference: -1,
        createdAt: new Date(),
      },
      {
        routineCheckId: "b",
        supplyCode: "W",
        supplyName: "Burger W",
        reportedValue: 300,
        expectedValue: 330,
        difference: -30,
        createdAt: new Date(),
      },
    ];
    const text = formatPendingMismatchList(items);
    expect(text).toContain("1. Burger F (F)");
    expect(text).toContain("2. Burger W (W)");
    expect(text).toContain("informado: 99");
    expect(text).toContain("diferença: -30");
    expect(text).toContain("Responda com o número");
  });
});
