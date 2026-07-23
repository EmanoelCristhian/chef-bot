import { z } from "zod";

/**
 * Telegram group / supergroup chat ids are always negative integers
 * (https://core.telegram.org/bots/api#chat — id is negative for groups).
 *
 * The bot's D9 authorization middleware compares `store.telegramGroupId` to
 * `ctx.chat.id` as exact strings. A missing leading "-" (e.g. seeding
 * "5107923619" instead of "-5107923619") silently discards every message —
 * no error, no reply — which already bit staging twice (2026-07).
 */
export const TELEGRAM_GROUP_ID_PATTERN = /^-\d+$/;

export const telegramGroupIdSchema = z
  .string()
  .regex(
    TELEGRAM_GROUP_ID_PATTERN,
    'Telegram group ids must be a negative integer string (e.g. "-5107923619"), not a positive one',
  );

export function parseTelegramGroupId(value: string): string {
  return telegramGroupIdSchema.parse(value);
}
