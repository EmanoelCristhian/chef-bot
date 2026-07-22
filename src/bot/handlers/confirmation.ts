import type { Context, Telegraf } from "telegraf";
import type { Db } from "src/persistence/db.js";
import { consumePending } from "src/bot/pendingCounts.js";
import { processConfirmedItems, formatCountBatchReply } from "src/domain/countBatch.js";
import * as storeRepo from "src/persistence/repositories/storeRepo.js";
import * as routineRepo from "src/persistence/repositories/routineRepo.js";
import * as dailyIngestionRunRepo from "src/persistence/repositories/dailyIngestionRunRepo.js";
import * as awaitingIngestionCountRepo from "src/persistence/repositories/awaitingIngestionCountRepo.js";

const COUNT_ROUTINE_NAME = "Contagem de Carne";

/**
 * D1: only proceeds to calculation/comparison after the collaborator confirms the
 * parse (handlers/count.ts stored the pending parse and showed the summary with buttons).
 */
export function registerConfirmationHandler(bot: Telegraf<Context>, db: Db): void {
  bot.action(/^confirm:(.+)$/, async (ctx) => {
    const id = (ctx.match as RegExpMatchArray)[1];
    await ctx.answerCbQuery();
    if (!id) return;

    const pendingCount = consumePending(id);
    if (!pendingCount) {
      await ctx.reply("Essa confirmação expirou ou já foi processada. Envie a contagem novamente.");
      return;
    }

    const activeStore = await storeRepo.findActiveStore(db);
    if (!activeStore) {
      await ctx.reply("Nenhuma loja ativa configurada — não é possível registrar a contagem.");
      return;
    }

    const routine = await routineRepo.findActiveByName(db, activeStore.id, COUNT_ROUTINE_NAME);
    if (!routine) {
      await ctx.reply(`Rotina "${COUNT_ROUTINE_NAME}" não está configurada para esta loja.`);
      return;
    }

    // B3 bot integration: a count can only be compared once that day's XML has been
    // ingested — otherwise "expected" would be missing that day's sales deductions.
    // Park it instead of comparing against an incomplete picture; an admin running
    // /ingest-xml later resumes it automatically (ingestionResume.ts).
    const ingested = await dailyIngestionRunRepo.hasRunForDate(db, activeStore.id, pendingCount.parse.date);
    if (!ingested) {
      await awaitingIngestionCountRepo.insert(db, {
        storeId: activeStore.id,
        routineId: routine.id,
        collaboratorTelegramId: pendingCount.collaboratorTelegramId,
        chatId: String(pendingCount.chatId),
        rawText: pendingCount.rawText,
        date: pendingCount.parse.date,
        items: pendingCount.parse.items,
      });
      await ctx.reply(
        `⏳ Ainda não recebi o XML de vendas de ${pendingCount.parse.date} — vou processar sua contagem automaticamente assim que um admin rodar a ingestão. Não precisa reenviar.`,
      );
      return;
    }

    const summary = await processConfirmedItems(db, bot, {
      storeId: activeStore.id,
      routineId: routine.id,
      collaboratorTelegramId: pendingCount.collaboratorTelegramId,
      rawText: pendingCount.rawText,
      items: pendingCount.parse.items,
    });

    await ctx.reply(formatCountBatchReply(summary));
  });

  bot.action(/^correct:(.+)$/, async (ctx) => {
    const id = (ctx.match as RegExpMatchArray)[1];
    await ctx.answerCbQuery();
    if (id) {
      consumePending(id);
    }
    await ctx.reply("Sem problemas — pode reenviar a contagem corrigida.");
  });
}
