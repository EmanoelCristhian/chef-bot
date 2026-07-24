import { describe, expect, it } from "vitest";
import {
  isSelectionExpired,
  MISMATCH_SELECTION_TTL_MS,
} from "src/persistence/repositories/pendingMismatchSelectionRepo.js";

describe("isSelectionExpired", () => {
  it("is false within the TTL window", () => {
    const createdAt = new Date("2026-07-23T12:00:00.000Z");
    const now = new Date(createdAt.getTime() + MISMATCH_SELECTION_TTL_MS - 1);
    expect(isSelectionExpired({ createdAt }, now)).toBe(false);
  });

  it("is true after the TTL window", () => {
    const createdAt = new Date("2026-07-23T12:00:00.000Z");
    const now = new Date(createdAt.getTime() + MISMATCH_SELECTION_TTL_MS + 1);
    expect(isSelectionExpired({ createdAt }, now)).toBe(true);
  });
});
