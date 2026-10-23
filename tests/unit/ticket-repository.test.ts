import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/server/db/client", () => ({ getDb: mocks.db }));
import { ticketsRepository } from "../../src/server/repositories/tickets";
const message = { id: "message", body: "reply", createdAt: new Date(), sender: { displayName: "A", role: "AUTHOR" } };
const tx = { $queryRaw: vi.fn(), ticket: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() }, ticketMessage: { findUnique: vi.fn(), create: vi.fn() }, ticketEvent: { create: vi.fn() } };
beforeEach(() => {
  vi.resetAllMocks(); mocks.db.mockReturnValue({ $transaction: (work: (client: typeof tx) => unknown) => work(tx) });
  tx.$queryRaw.mockResolvedValue([{ id: "ticket" }]); tx.ticket.findFirst.mockResolvedValue({ id: "ticket", status: "OPEN" });
  tx.ticketMessage.findUnique.mockResolvedValue(null); tx.ticketMessage.create.mockResolvedValue(message);
});
describe("atomic reply repository (mocked database)", () => {
  it("locks before checking status and records a message/event without changing status", async () => {
    await ticketsRepository.reply("ticket", "AUTH001", "user", "reply", "request");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.ticket.findFirst.mock.invocationCallOrder[0]);
    expect(tx.ticket.findFirst).toHaveBeenCalledWith({ where: { id: "ticket", authorId: "AUTH001" } });
    expect(tx.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketId: "ticket", senderId: "user", body: "reply", clientRequestId: "request" } }));
    expect(tx.ticket.update.mock.calls[0][0].data).not.toHaveProperty("status"); expect(tx.ticketEvent.create).toHaveBeenCalledOnce();
  });
  it("rejects closed-ticket replies from both roles without writing", async () => {
    tx.ticket.findFirst.mockResolvedValue({ status: "CLOSED" });
    for (const authorId of ["AUTH001", undefined]) await expect(ticketsRepository.reply("ticket", authorId, "user", "reply", "request")).rejects.toMatchObject({ code: "TICKET_CLOSED", status: 409 });
    expect(tx.ticketMessage.create).not.toHaveBeenCalled(); expect(tx.ticket.update).not.toHaveBeenCalled();
  });
  it("keeps resolved status and records the author attention timestamp", async () => {
    tx.ticket.findFirst.mockResolvedValue({ status: "RESOLVED" });
    await ticketsRepository.reply("ticket", "AUTH001", "user", "reply", "request");
    expect(tx.ticket.update.mock.calls[0][0].data).toMatchObject({ resolvedAuthorReplyAt: message.createdAt });
    expect(tx.ticket.update.mock.calls[0][0].data).not.toHaveProperty("status");
  });
  it("replays committed messages even if subsequently closed, without duplicate events", async () => {
    tx.ticket.findFirst.mockResolvedValue({ status: "CLOSED" }); tx.ticketMessage.findUnique.mockResolvedValue(message);
    expect((await ticketsRepository.reply("ticket", "AUTH001", "user", "reply", "request")).replayed).toBe(true);
    await expect(ticketsRepository.reply("ticket", "AUTH001", "user", "changed", "request")).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(tx.ticketMessage.create).not.toHaveBeenCalled(); expect(tx.ticketEvent.create).not.toHaveBeenCalled();
  });
  it("rejects ownership changes inside the transaction", async () => {
    tx.ticket.findFirst.mockResolvedValue(null);
    await expect(ticketsRepository.reply("ticket", "AUTH002", "user", "reply", "request")).rejects.toMatchObject({ status: 404 });
    expect(tx.ticketMessage.create).not.toHaveBeenCalled();
  });
});
