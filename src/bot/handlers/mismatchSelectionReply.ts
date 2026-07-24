import type { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { Db } from "src/persistence/db.js";
import * as pendingMismatchSelectionRepo from "src/persistence/repositories/pendingMismatchSelectionRepo.js";
import { acceptMismatchByRoutineCheckId, formatAcceptReply } from "src/domain/acceptMismatch.js";

const PURE_NUMBER = /^\d+$/;

/**
 * Intercepts a plain number reply ("1", "2", …) when the chat has an active
 * /confirma_contagem selection. Must be registered BEFORE the free-text count
 * catch-all (same lesson as PR #18). If there is no selection, calls next() so
 * normal counts (including messages that happen to be only digits) still work.
 */
export function registerMismatchSelectionReplyHandler(bot: Telegraf<Context>, db: Db): void {
  bot.on(message("text"), async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (!PURE_NUMBER.test(text)) {
      return next();
    }

    const chatId = String(ctx.chat.id);
    const selection = await pendingMismatchSelectionRepo.findByChatId(db, chatId);
    if (!selection) {
      return next();
    }

    if (pendingMismatchSelectionRepo.isSelectionExpired(selection)) {
      await pendingMismatchSelectionRepo.deleteByChatId(db, chatId);
      await ctx.reply("Seleção expirada. Rode /confirma_contagem de novo.");
      return;
    }

    const index = Number(text);
    const ids = selection.routineCheckIds;
    if (!Number.isInteger(index) || index < 1 || index > ids.length) {
      await ctx.reply(`Número inválido. Escolha de 1 a ${ids.length}.`);
      return;
    }

    const routineCheckId = ids[index - 1];
    if (!routineCheckId) {
      await ctx.reply(`Número inválido. Escolha de 1 a ${ids.length}.`);
      return;
    }

    const acceptedByTelegramId = ctx.from?.id?.toString();
    if (!acceptedByTelegramId) {
      await ctx.reply("Não consegui identificar quem está confirmando.");
      return;
    }

    const result = await acceptMismatchByRoutineCheckId(db, {
      routineCheckId,
      acceptedByTelegramId,
    });

    // Consumed after a pick attempt that reached accept (success or already used).
    await pendingMismatchSelectionRepo.deleteByChatId(db, chatId);
    await ctx.reply(formatAcceptReply(result));
  });
}
