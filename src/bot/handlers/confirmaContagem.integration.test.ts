import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Telegram } from "telegraf";
import type { Update } from "telegraf/types";
import { createBot } from "src/bot/telegram.js";
import { registerConfirmaContagemCommand } from "src/bot/handlers/confirmaContagem.js";
import { registerMismatchSelectionReplyHandler } from "src/bot/handlers/mismatchSelectionReply.js";
import { registerCountHandler } from "src/bot/handlers/count.js";
import * as countRepo from "src/persistence/repositories/countRepo.js";
import * as pendingMismatchSelectionRepo from "src/persistence/repositories/pendingMismatchSelectionRepo.js";
import * as routineCheckRepo from "src/persistence/repositories/routineCheckRepo.js";
import {
  createTestRoutine,
  createTestStore,
  createTestSupply,
  getTestDb,
  resetDatabase,
} from "src/persistence/repositories/testUtils.js";
import type { LLMParser } from "src/llm/llmParser.js";

const db = getTestDb();
const GROUP_ID = "555";

beforeEach(async () => {
  await resetDatabase(db);
});

afterAll(async () => {
  await resetDatabase(db);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stubTelegramApi() {
  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  vi.spyOn(Telegram.prototype, "callApi").mockImplementation(async (method: string, payload: unknown) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: 0, type: "group" } };
  });
  return calls;
}

function commandEntityLength(commandText: string): number {
  const match = commandText.match(/^\/[A-Za-z0-9_]*/);
  return match ? match[0].length : 1;
}

function commandUpdate(commandText: string, chatId: number, fromId: number): Update {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: {
      message_id: Math.floor(Math.random() * 1_000_000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "group", title: "Test Group" },
      from: { id: fromId, is_bot: false, first_name: "Tester" },
      text: commandText,
      entities: [{ type: "bot_command", offset: 0, length: commandEntityLength(commandText) }],
    },
  } as unknown as Update;
}

function textUpdate(text: string, chatId: number, fromId: number): Update {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: {
      message_id: Math.floor(Math.random() * 1_000_000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "group", title: "Test Group" },
      from: { id: fromId, is_bot: false, first_name: "Tester" },
      text,
    },
  } as unknown as Update;
}

function lastReplyText(calls: { method: string; payload: Record<string, unknown> }[]): string {
  const reply = calls.filter((c) => c.method === "sendMessage").at(-1);
  return String(reply?.payload.text ?? "");
}

describe("/confirma_contagem + number selection", () => {
  it("replies with empty message when there is no pending mismatch", async () => {
    await createTestStore(db, { telegramGroupId: GROUP_ID });
    const bot = createBot("fake-token", GROUP_ID);
    const calls = stubTelegramApi();
    registerConfirmaContagemCommand(bot, db);

    await bot.handleUpdate(commandUpdate("/confirma_contagem", 555, 111));

    expect(lastReplyText(calls)).toContain("Nenhuma contagem pendente de confirmação");
  });

  it("lists pending mismatches and accepts a valid number pick", async () => {
    const testStore = await createTestStore(db, { telegramGroupId: GROUP_ID });
    const testRoutine = await createTestRoutine(db, testStore.id);
    const supplyF = await createTestSupply(db, testStore.id, { code: "F", name: "Burger F" });
    await countRepo.insert(db, {
      storeId: testStore.id,
      routineId: testRoutine.id,
      supplyId: supplyF.id,
      collaboratorTelegramId: "1",
      confirmedByTelegramId: "1",
      rawText: "99 F",
      reportedValue: 99,
      actualQuantityReported: null,
      locationBreakdown: null,
      expectedValue: 100,
      matched: false,
      confirmedByCollaborator: true,
    });

    const bot = createBot("fake-token", GROUP_ID);
    const calls = stubTelegramApi();
    registerConfirmaContagemCommand(bot, db);
    registerMismatchSelectionReplyHandler(bot, db);

    await bot.handleUpdate(commandUpdate("/confirma_contagem", 555, 111));
    expect(lastReplyText(calls)).toContain("1. Burger F (F)");
    expect(lastReplyText(calls)).toContain("informado: 99");

    const selection = await pendingMismatchSelectionRepo.findByChatId(db, "555");
    expect(selection?.routineCheckIds).toHaveLength(1);

    await bot.handleUpdate(textUpdate("1", 555, 222));
    expect(lastReplyText(calls)).toContain("aceita como estoque real");
    expect(lastReplyText(calls)).toContain("informado: 99");

    const pending = await routineCheckRepo.findPendingMismatchesByStore(db, testStore.id);
    expect(pending).toHaveLength(0);
    expect(await pendingMismatchSelectionRepo.findByChatId(db, "555")).toBeNull();
  });

  it("rejects an out-of-range number with a clear error and keeps the selection", async () => {
    const testStore = await createTestStore(db, { telegramGroupId: GROUP_ID });
    const testRoutine = await createTestRoutine(db, testStore.id);
    const supplyF = await createTestSupply(db, testStore.id, { code: "F", name: "Burger F" });
    await countRepo.insert(db, {
      storeId: testStore.id,
      routineId: testRoutine.id,
      supplyId: supplyF.id,
      collaboratorTelegramId: "1",
      confirmedByTelegramId: "1",
      rawText: "99 F",
      reportedValue: 99,
      actualQuantityReported: null,
      locationBreakdown: null,
      expectedValue: 100,
      matched: false,
      confirmedByCollaborator: true,
    });

    const bot = createBot("fake-token", GROUP_ID);
    const calls = stubTelegramApi();
    registerConfirmaContagemCommand(bot, db);
    registerMismatchSelectionReplyHandler(bot, db);

    await bot.handleUpdate(commandUpdate("/confirma_contagem", 555, 111));
    await bot.handleUpdate(textUpdate("9", 555, 111));

    expect(lastReplyText(calls)).toContain("Número inválido");
    expect(await pendingMismatchSelectionRepo.findByChatId(db, "555")).not.toBeNull();
  });

  it("rejects an expired selection with a clear error", async () => {
    const testStore = await createTestStore(db, { telegramGroupId: GROUP_ID });
    const testRoutine = await createTestRoutine(db, testStore.id);
    const supplyF = await createTestSupply(db, testStore.id, { code: "F", name: "Burger F" });
    const mismatch = await countRepo.insert(db, {
      storeId: testStore.id,
      routineId: testRoutine.id,
      supplyId: supplyF.id,
      collaboratorTelegramId: "1",
      confirmedByTelegramId: "1",
      rawText: "99 F",
      reportedValue: 99,
      actualQuantityReported: null,
      locationBreakdown: null,
      expectedValue: 100,
      matched: false,
      confirmedByCollaborator: true,
    });

    await pendingMismatchSelectionRepo.upsertForChat(db, {
      chatId: "555",
      storeId: testStore.id,
      routineCheckIds: [mismatch.routineCheckId],
    });
    // Force expiry by rewriting created_at in the past.
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`UPDATE pending_mismatch_selection SET created_at = NOW() - INTERVAL '20 minutes'`);

    const bot = createBot("fake-token", GROUP_ID);
    const calls = stubTelegramApi();
    registerMismatchSelectionReplyHandler(bot, db);

    await bot.handleUpdate(textUpdate("1", 555, 111));

    expect(lastReplyText(calls)).toContain("Seleção expirada");
    expect(await pendingMismatchSelectionRepo.findByChatId(db, "555")).toBeNull();
  });

  it("does not intercept a plain number when there is no active selection (forwards to count)", async () => {
    await createTestStore(db, { telegramGroupId: GROUP_ID });
    const bot = createBot("fake-token", GROUP_ID);
    const calls = stubTelegramApi();

    const llmParser: LLMParser = {
      parse: async () => {
        throw new Error("llm should be reached");
      },
    };

    registerMismatchSelectionReplyHandler(bot, db);
    registerCountHandler(bot, { llmParser, db });

    await bot.handleUpdate(textUpdate("1", 555, 111));

    // Count handler caught the forwarded message and replied with its parse-error copy.
    expect(lastReplyText(calls)).toContain("Não consegui interpretar");
  });
});
