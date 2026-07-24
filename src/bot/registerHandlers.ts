import type { Context, Telegraf } from "telegraf";
import type { Db } from "src/persistence/db.js";
import type { LLMParser } from "src/llm/llmParser.js";
import { registerMovementHandler } from "src/bot/handlers/movement.js";
import { registerConfirmationHandler } from "src/bot/handlers/confirmation.js";
import { registerCountHandler } from "src/bot/handlers/count.js";
import { registerIngestXmlCommand, type IngestXmlHandlerDeps } from "src/bot/handlers/ingestXml.js";
import { registerPingCommand } from "src/bot/handlers/ping.js";
import { registerLlmCheckCommand } from "src/bot/handlers/llmCheck.js";
import { registerConfirmaContagemCommand } from "src/bot/handlers/confirmaContagem.js";
import { registerMismatchSelectionReplyHandler } from "src/bot/handlers/mismatchSelectionReply.js";

export interface RegisterHandlersDeps {
  db: Db;
  llmParser: LLMParser;
  adminTelegramIds: string[];
  ingestXml: IngestXmlHandlerDeps;
}

/**
 * Registers every bot handler in a fixed order that Telegraf's middleware chain
 * requires: specific `bot.command` / `bot.action` handlers first, free-text
 * catch-all (`registerCountHandler`) last.
 *
 * Why this is a function and not a comment-enforced convention: Telegraf runs
 * middleware in registration order and stops the chain when a handler returns
 * without calling `next()`. The count catch-all matches *any* text message
 * (including commands). If a command is registered after it, that command is
 * unreachable — confirmed in production for `/ingest_xml` (2026-07-23). Keeping
 * the catch-all as the final registration here makes that order structural.
 *
 * `registerMismatchSelectionReplyHandler` also listens to text, but only claims
 * pure-number messages when a /confirma_contagem selection is active; otherwise
 * it calls next() so the count catch-all still runs.
 */
export function registerHandlers(bot: Telegraf<Context>, deps: RegisterHandlersDeps): void {
  registerPingCommand(bot);
  registerLlmCheckCommand(bot, {
    adminTelegramIds: deps.adminTelegramIds,
    llmParser: deps.llmParser,
  });
  registerConfirmaContagemCommand(bot, deps.db);
  registerMismatchSelectionReplyHandler(bot, deps.db);
  registerMovementHandler(bot, deps.db);
  registerConfirmationHandler(bot, deps.db);
  registerIngestXmlCommand(bot, deps.db, deps.ingestXml);
  // Catch-all last — must stay after every bot.command / bot.action / selection reply above.
  registerCountHandler(bot, { llmParser: deps.llmParser, db: deps.db });
}
