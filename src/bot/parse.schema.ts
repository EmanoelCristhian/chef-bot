import { z } from "zod";
import { DATE_ONLY_PATTERN } from "src/domain/dateOnly.js";

/**
 * One item of the count in free text, e.g., "742 G" -> { supply: "G", quantity: 742 }.
 * actualQuantity is only filled in when the employee reports the actual quantity of a
 * variable-quantity package in the message itself (D5) — null in the common case.
 */
export const countItemSchema = z.object({
  supply: z.string().min(1),
  quantity: z.number().finite(),
  actualQuantity: z.number().finite().nullable().default(null),
});

// B3 bot integration: which day this count is for, "YYYY-MM-DD" — the LLM resolves
// relative mentions ("hoje") using the current date given in its system prompt
// (claudeClient.ts), and defaults to today when the employee doesn't mention a date at
// all (the common case). Required, not inferred here, so a garbled date is caught by
// Zod validation (and D1's confirmation step) instead of silently defaulting.
export const countParseSchema = z.object({
  date: z.string().regex(DATE_ONLY_PATTERN, "date must be in YYYY-MM-DD format"),
  items: z.array(countItemSchema).min(1),
});

export type CountItem = z.infer<typeof countItemSchema>;
export type ParsedCount = z.infer<typeof countParseSchema>;
