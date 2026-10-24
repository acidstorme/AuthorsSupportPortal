import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/server/db/client", () => ({ getDb: mocks.db }));
import { aiRepository } from "../../src/server/repositories/ai";
const tx = { ticket: { updateMany: vi.fn(), findUnique: vi.fn() }, ticketEvent: { create: vi.fn() } };
const started = new Date("2026-10-24T06:00:00Z");
const provider = { kind: "MOCK" as const, model: "deterministic-v1" };
beforeEach(() => { vi.resetAllMocks(); mocks.db.mockReturnValue({ ...tx, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) }); tx.ticket.updateMany.mockResolvedValue({ count: 1 }); });
describe("AI database claims and completion guards (mocked Prisma)", () => {
  it("claims classification with a 30-second cooldown and never changes manual fields", async () => {
    expect(await aiRepository.claim("ticket", "classification", started)).toBe(true);
    const { where, data } = tx.ticket.updateMany.mock.calls[0][0];
    expect(where.OR).toContainEqual({ aiStartedAt: { lte: new Date(started.getTime() - 30000) } });
    expect(data).toEqual({ aiStartedAt: started, aiStatus: "RUNNING", aiErrorCode: null });
  });
  it("saves AI result and event atomically only for the current claim", async () => {
    await aiRepository.finishClassification("ticket", started, provider, { category: "GENERAL_INQUIRY", priority: "LOW" }, null);
    const { where, data } = tx.ticket.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "ticket", aiStartedAt: started, aiStatus: "RUNNING" });
    expect(data).toMatchObject({ aiCategory: "GENERAL_INQUIRY", aiPriority: "LOW", aiProvider: "MOCK" });
    expect(data).not.toHaveProperty("manualCategory"); expect(data).not.toHaveProperty("manualPriority");
    expect(tx.ticketEvent.create).toHaveBeenCalledOnce();
    tx.ticketEvent.create.mockClear(); tx.ticket.updateMany.mockResolvedValue({ count: 0 });
    expect(await aiRepository.finishClassification("ticket", started, provider, null, "TIMEOUT")).toBe(false);
    expect(tx.ticketEvent.create).not.toHaveBeenCalled();
  });
  it("failure preserves earlier AI results and all manual values", async () => {
    await aiRepository.finishClassification("ticket", started, null, null, "PROVIDER_UNAVAILABLE");
    const data = tx.ticket.updateMany.mock.calls[0][0].data;
    expect(data.aiStatus).toBe("FAILED"); expect(data).not.toHaveProperty("aiCategory"); expect(data).not.toHaveProperty("manualPriority");
  });
  it("guards draft claims against closed tickets, stale completions and cache erasure on errors", async () => {
    await aiRepository.claim("ticket", "draft", started);
    expect(tx.ticket.updateMany.mock.calls[0][0].where.status).toEqual({ not: "CLOSED" });
    await aiRepository.finishDraft("ticket", started, provider, "hash", null, "TIMEOUT");
    expect(tx.ticket.updateMany.mock.calls[1][0]).toEqual({ where: { id: "ticket", draftStartedAt: started }, data: { draftErrorCode: "TIMEOUT" } });
  });
  it("loads only bounded public conversation and excludes private notes and contact details", async () => {
    tx.ticket.findUnique.mockResolvedValue({ subject: "Help", description: "Query", status: "OPEN", book: null, manualCategory: null, manualPriority: null, aiCategory: null, aiPriority: null, messages: [{ id: "m", body: "x".repeat(8000), createdAt: started, sender: { role: "AUTHOR" } }], _count: { messages: 22 }, draftText: "PRIVATE", authorEmail: "PRIVATE" });
    const result = await aiRepository.load("ticket");
    const query = tx.ticket.findUnique.mock.calls[0][0];
    expect(query.include.messages.take).toBe(6); expect(query.include).not.toHaveProperty("notes");
    expect(result?.context.messages[0].body.length).toBe(1000); expect(result?.context.omittedMessages).toBe(21);
    expect(JSON.stringify(result?.context)).not.toContain("PRIVATE");
  });
});
