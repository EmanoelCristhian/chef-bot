import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as dailyIngestionRunRepo from "src/persistence/repositories/dailyIngestionRunRepo.js";
import { createTestStore, getTestDb, resetDatabase } from "src/persistence/repositories/testUtils.js";

const db = getTestDb();

beforeEach(async () => {
  await resetDatabase(db);
});

afterAll(async () => {
  await resetDatabase(db);
});

describe("dailyIngestionRunRepo", () => {
  it("reports no run for a date that was never recorded", async () => {
    const testStore = await createTestStore(db);

    expect(await dailyIngestionRunRepo.hasRunForDate(db, testStore.id, "2026-07-22")).toBe(false);
  });

  it("reports a run once recorded", async () => {
    const testStore = await createTestStore(db);

    await dailyIngestionRunRepo.recordRun(db, testStore.id, "2026-07-22");

    expect(await dailyIngestionRunRepo.hasRunForDate(db, testStore.id, "2026-07-22")).toBe(true);
  });

  it("does not confuse a run recorded for one date with another date", async () => {
    const testStore = await createTestStore(db);

    await dailyIngestionRunRepo.recordRun(db, testStore.id, "2026-07-21");

    expect(await dailyIngestionRunRepo.hasRunForDate(db, testStore.id, "2026-07-22")).toBe(false);
  });

  it("is idempotent — recording the same (store, date) twice does not throw", async () => {
    const testStore = await createTestStore(db);

    await dailyIngestionRunRepo.recordRun(db, testStore.id, "2026-07-22");
    await expect(dailyIngestionRunRepo.recordRun(db, testStore.id, "2026-07-22")).resolves.not.toThrow();
  });
});
