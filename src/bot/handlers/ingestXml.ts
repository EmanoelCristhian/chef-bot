import type { Context, Telegraf } from "telegraf";
import type { Db } from "src/persistence/db.js";
import { createAdminMiddleware } from "src/bot/middleware/authorization.js";
import * as storeRepo from "src/persistence/repositories/storeRepo.js";
import * as dailyIngestionRunRepo from "src/persistence/repositories/dailyIngestionRunRepo.js";
import { ingestDailySales, type IngestDailySalesResult } from "src/salesXml/dailySalesIngestion.js";
import type { DriveFilesApi } from "src/salesXml/driveFileFinder.js";
import type { DriveFileContentApi } from "src/salesXml/driveFileContent.js";
import { resumeAwaitingCounts } from "src/domain/ingestionResume.js";
import { DATE_ONLY_PATTERN, parseDateOnly } from "src/domain/dateOnly.js";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatIngestionSummary(result: IngestDailySalesResult): string {
  const lines = [
    `Arquivos encontrados: ${result.totalFilesFound}`,
    `Processados: ${result.processed.length}`,
    `Já processados antes (ignorados): ${result.skippedAlreadyProcessed.length}`,
    `Erros: ${result.errors.length}`,
  ];
  for (const error of result.errors) {
    lines.push(`⚠️ ${error.fileName}: ${error.error}`);
  }
  return lines.join("\n");
}

export interface IngestXmlHandlerDeps {
  adminTelegramIds: string[];
  driveFiles: DriveFilesApi & DriveFileContentApi;
  rootFolderId: string;
}

/**
 * B3 bot integration: manual trigger (D11 — no scheduler) for the daily NFC-e
 * ingestion, restricted to admins. Confirmed automatic-resume behavior: once this
 * finishes, every count parked in "aguardando_ingestao" for the same date
 * (handlers/confirmation.ts) is processed right away (domain/ingestionResume.ts).
 */
export function registerIngestXmlCommand(bot: Telegraf<Context>, db: Db, deps: IngestXmlHandlerDeps): void {
  bot.command("ingest-xml", createAdminMiddleware(deps.adminTelegramIds), async (ctx) => {
    const activeStore = await storeRepo.findActiveStore(db);
    if (!activeStore) {
      await ctx.reply("Nenhuma loja ativa configurada.");
      return;
    }

    const dateArg = ctx.message.text.trim().split(/\s+/)[1];
    if (dateArg && !DATE_ONLY_PATTERN.test(dateArg)) {
      await ctx.reply("Formato inválido. Use: /ingest-xml [AAAA-MM-DD] (sem data, usa hoje).");
      return;
    }
    const dateIso = dateArg ?? todayIso();

    await ctx.reply(`⏳ Ingerindo XML de vendas de ${dateIso}...`);

    let result: IngestDailySalesResult;
    try {
      result = await ingestDailySales(db, deps.driveFiles, deps.rootFolderId, activeStore.id, parseDateOnly(dateIso));
    } catch (error) {
      console.error("Failed to ingest daily sales XML:", error);
      await ctx.reply("❌ Falha ao acessar o Google Drive. A ingestão não foi registrada — tente novamente.");
      return;
    }

    // Only recorded on success (even a partial one with per-file errors) — a
    // Drive-access failure above must not mark the date as "ingested".
    await dailyIngestionRunRepo.recordRun(db, activeStore.id, dateIso);
    await ctx.reply(formatIngestionSummary(result));

    const resumedCount = await resumeAwaitingCounts(bot, db, activeStore.id, dateIso);
    if (resumedCount > 0) {
      await ctx.reply(`🔄 ${resumedCount} contagem(ns) pendente(s) processada(s) automaticamente.`);
    }
  });
}
