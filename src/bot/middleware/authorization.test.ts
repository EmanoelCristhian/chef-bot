import { describe, expect, it, vi } from "vitest";
import type { Context } from "telegraf";
import { createAdminMiddleware, createAuthorizationMiddleware } from "src/bot/middleware/authorization.js";

function fakeCtx(chatId: number | undefined): Context {
  return { chat: chatId === undefined ? undefined : { id: chatId } } as unknown as Context;
}

function fakeCtxWithFrom(userId: number | undefined) {
  return {
    from: userId === undefined ? undefined : { id: userId },
    reply: vi.fn(),
  } as unknown as Context & { reply: ReturnType<typeof vi.fn> };
}

describe("createAuthorizationMiddleware", () => {
  it("calls next() for a message from the configured group", async () => {
    const middleware = createAuthorizationMiddleware("-1001234567890");
    const next = vi.fn();

    await middleware(fakeCtx(-1001234567890), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("does not call next() for a message from a different chat", async () => {
    const middleware = createAuthorizationMiddleware("-1001234567890");
    const next = vi.fn();

    await middleware(fakeCtx(-1009999999999), next);

    expect(next).not.toHaveBeenCalled();
  });

  it("does not call next() when the update has no chat", async () => {
    const middleware = createAuthorizationMiddleware("-1001234567890");
    const next = vi.fn();

    await middleware(fakeCtx(undefined), next);

    expect(next).not.toHaveBeenCalled();
  });
});

describe("createAdminMiddleware", () => {
  it("calls next() for a Telegram id in the admin list", async () => {
    const middleware = createAdminMiddleware(["111", "222"]);
    const next = vi.fn();

    await middleware(fakeCtxWithFrom(111), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("replies with a denial and does not call next() for a Telegram id not in the admin list", async () => {
    const middleware = createAdminMiddleware(["111", "222"]);
    const next = vi.fn();
    const ctx = fakeCtxWithFrom(999);

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("restrito a administradores"));
  });

  it("denies when the admin list is empty", async () => {
    const middleware = createAdminMiddleware([]);
    const next = vi.fn();

    await middleware(fakeCtxWithFrom(111), next);

    expect(next).not.toHaveBeenCalled();
  });

  it("denies when the update has no from", async () => {
    const middleware = createAdminMiddleware(["111"]);
    const next = vi.fn();

    await middleware(fakeCtxWithFrom(undefined), next);

    expect(next).not.toHaveBeenCalled();
  });
});
