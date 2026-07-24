import type { Context, Telegraf } from "telegraf";
import type { Db } from "src/persistence/db.js";
import * as storeRepo from "src/persistence/repositories/storeRepo.js";
import * as routineCheckRepo from "src/persistence/repositories/routineCheckRepo.js";
import * as pendingMismatchSelectionRepo from "src/persistence/repositories/pendingMismatchSelectionRepo.js";
import { formatPendingMismatchList } from "src/domain/acceptMismatch.js";
import { withCommandLogging } from "src/logging/withCommandLogging.js";

/**
 * /confirma_contagem — lists all pending mismatches (mismatched + not accepted) for the
 * active store and persists a numbered selection for this chat. Any group member (D9).
 * Selection reply is handled by registerMismatchSelectionReplyHandler.
 */
export function registerConfirmaContagemCommand(bot: Telegraf<Context>, db: Db): void {
  bot.command(
    "confirma_contagem",
    withCommandLogging("confirma_contagem", async (ctx) => {
      const activeStore = await storeRepo.findActiveStore(db);
      if (!activeStore) {
        await ctx.reply("Nenhuma loja ativa configurada.");
        return;
      }

      const pending = await routineCheckRepo.findPendingMismatchesByStore(db, activeStore.id);
      if (pending.length === 0) {
        await ctx.reply("Nenhuma contagem pendente de confirmação.");
        return;
      }

      const chatId = String(ctx.chat?.id ?? "");
      if (!chatId) {
        await ctx.reply("Não consegui identificar o chat.");
        return;
      }

      await pendingMismatchSelectionRepo.upsertForChat(db, {
        chatId,
        storeId: activeStore.id,
        routineCheckIds: pending.map((row) => row.routineCheckId),
      });

      await ctx.reply(formatPendingMismatchList(pending));
    }),
  );
}
