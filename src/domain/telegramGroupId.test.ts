import { describe, expect, it } from "vitest";
import { parseTelegramGroupId, telegramGroupIdSchema } from "src/domain/telegramGroupId.js";

describe("telegramGroupIdSchema", () => {
  it("accepts a negative integer string (real Telegram group id shape)", () => {
    expect(telegramGroupIdSchema.parse("-5107923619")).toBe("-5107923619");
    expect(parseTelegramGroupId("-1001234567890")).toBe("-1001234567890");
  });

  it("rejects a positive id — the exact seed bug that silently broke D9 auth", () => {
    const result = telegramGroupIdSchema.safeParse("5107923619");
    expect(result.success).toBe(false);
    expect(() => parseTelegramGroupId("5107923619")).toThrow(/negative integer/);
  });

  it("rejects empty, non-numeric, and hyphen-only values", () => {
    expect(telegramGroupIdSchema.safeParse("").success).toBe(false);
    expect(telegramGroupIdSchema.safeParse("-").success).toBe(false);
    expect(telegramGroupIdSchema.safeParse("abc").success).toBe(false);
    expect(telegramGroupIdSchema.safeParse("-5107923619x").success).toBe(false);
  });
});
