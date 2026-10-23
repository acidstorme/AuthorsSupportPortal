import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/server/db/client", () => ({ getDb: mocks.db }));
import { adminTicketsRepository } from "../../src/server/repositories/admin-tickets";
import { adminQueueSchema } from "../../src/server/validation/admin-tickets";
const tx = { $queryRaw: vi.fn(), ticket: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn() }, ticketEvent: { create: vi.fn() }, ticketNote: { create: vi.fn(), findUnique: vi.fn() }, user: { findFirst: vi.fn() } };
const now = new Date("2026-10-23T12:00:00.000Z");
const ticket = { id: "ticket", status: "OPEN", assignedToId: null, manualCategory: null, manualPriority: null, aiPriority: "HIGH", resolvedAuthorReplyAt: now, authorReplySeenAt: null };
beforeEach(() => { vi.resetAllMocks(); mocks.db.mockReturnValue({ $transaction: (fn: (tx: unknown) => unknown) => fn(tx) }); tx.$queryRaw.mockResolvedValue([{ id: "ticket" }]); tx.ticket.findUnique.mockResolvedValue(ticket); tx.ticket.findUniqueOrThrow.mockResolvedValue(ticket); tx.user.findFirst.mockResolvedValue({ id: "admin" }); tx.ticketNote.create.mockResolvedValue({ id: "note" }); });
describe("admin ticket atomic mutations (mocked Prisma)", () => {
  it("takes the same FOR UPDATE ticket lock used by replies before changing status", async () => {
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "update", input: { status: "CLOSED" } });
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain("FROM app.tickets WHERE id = ?::uuid FOR UPDATE");
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.ticket.findUnique.mock.invocationCallOrder[0]);
    expect(tx.ticket.update).toHaveBeenCalledWith({ where: { id: "ticket" }, data: { status: "CLOSED" } });
    expect(tx.ticketEvent.create).toHaveBeenCalledWith({ data: { ticketId: "ticket", actorId: "admin", type: "STATUS_CHANGED", metadata: { from: "OPEN", to: "CLOSED" } } });
  });
  it("supports explicit status changes including reopening, with no automatic transitions", async () => {
    for (const from of ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) for (const to of ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const) {
      tx.ticket.findUnique.mockResolvedValue({ ...ticket, status: from }); tx.ticket.update.mockClear(); tx.ticketEvent.create.mockClear();
      await adminTicketsRepository.mutate("ticket", "admin", { kind: "update", input: { status: to } });
      expect(tx.ticket.update).toHaveBeenCalledTimes(from === to ? 0 : 1);
      expect(tx.ticketEvent.create).toHaveBeenCalledTimes(from === to ? 0 : 1);
    }
  });
  it("assignment checks admin role, never changes status and ignores repeated no-op", async () => {
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "assignment", assignee: "admin" });
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "admin", role: "ADMIN" }, select: { id: true } });
    expect(tx.ticket.update.mock.calls[0][0].data).toEqual({ assignedToId: "admin" });
    tx.user.findFirst.mockResolvedValue(null);
    await expect(adminTicketsRepository.mutate("ticket", "admin", { kind: "assignment", assignee: "author" })).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
    tx.ticket.update.mockClear(); await adminTicketsRepository.mutate("ticket", "admin", { kind: "assignment", assignee: null }); expect(tx.ticket.update).not.toHaveBeenCalled();
  });
  it("manual fields never modify AI values, and clearing overrides uses null", async () => {
    tx.ticket.findUnique.mockResolvedValue({ ...ticket, manualPriority: "CRITICAL" });
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "update", input: { manualCategory: "GENERAL_INQUIRY", manualPriority: null } });
    expect(tx.ticket.update.mock.calls[0][0].data).toEqual({ manualCategory: "GENERAL_INQUIRY", manualPriority: null });
  });
  it("keeps note text in the private table and excludes it from audit metadata", async () => {
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "note", body: "Private text", requestId: "note" });
    expect(tx.ticketNote.create).toHaveBeenCalledWith({ data: { id: "note", ticketId: "ticket", creatorId: "admin", body: "Private text" } });
    expect(tx.ticket.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(tx.ticketEvent.create.mock.calls[0][0].data.metadata).toEqual({ noteId: "note" });
  });
  it("rejects stale acknowledgements, acknowledges exactly the observed reply and deduplicates", async () => {
    await expect(adminTicketsRepository.mutate("ticket", "admin", { kind: "acknowledge", observedReplyAt: "2026-10-23T11:00:00Z" })).rejects.toMatchObject({ code: "ATTENTION_CHANGED" });
    expect(tx.ticket.update).not.toHaveBeenCalled();
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "acknowledge", observedReplyAt: now.toISOString() });
    expect(tx.ticket.update.mock.calls[0][0].data).toEqual({ authorReplySeenAt: now });
    tx.ticket.update.mockClear(); tx.ticketEvent.create.mockClear(); tx.ticket.findUnique.mockResolvedValue({ ...ticket, authorReplySeenAt: now });
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "acknowledge", observedReplyAt: now.toISOString() });
    expect(tx.ticket.update).not.toHaveBeenCalled(); expect(tx.ticketEvent.create).not.toHaveBeenCalled();
  });
  it("missing tickets do not write events", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(adminTicketsRepository.mutate("missing", "admin", { kind: "note", body: "no", requestId: "note" })).rejects.toMatchObject({ status: 404 });
    expect(tx.ticketEvent.create).not.toHaveBeenCalled();
  });
  it("deduplicates private notes and rejects request ID reuse across content or tickets", async () => {
    tx.ticketNote.findUnique.mockResolvedValue({ ticketId: "ticket", creatorId: "admin", body: "Private" });
    await adminTicketsRepository.mutate("ticket", "admin", { kind: "note", body: "Private", requestId: "note" });
    expect(tx.ticketNote.create).not.toHaveBeenCalled(); expect(tx.ticketEvent.create).not.toHaveBeenCalled();
    await expect(adminTicketsRepository.mutate("ticket", "admin", { kind: "note", body: "Changed", requestId: "note" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    tx.ticketNote.findUnique.mockResolvedValue({ ticketId: "other-ticket", creatorId: "admin", body: "Private" });
    await expect(adminTicketsRepository.mutate("ticket", "admin", { kind: "note", body: "Private", requestId: "note" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("builds parameterized effective-value filters, priority order and bounded pagination", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ id: "ticket" }]).mockResolvedValueOnce([{ total: 31n }]);
    tx.ticket.findMany.mockResolvedValue([{ id: "ticket" }]);
    const search = "' OR TRUE --";
    const query = adminQueueSchema.parse({ category: "GENERAL_INQUIRY", priority: "HIGH", status: "RESOLVED", search, assignment: "mine", attention: "unseen", sort: "priority_desc", page: 2, pageSize: 20 });
    const result = await adminTicketsRepository.queue(query, "admin");
    expect(result.total).toBe(31);
    const sql = tx.$queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain("COALESCE(t.manual_priority, t.ai_priority) ASC NULLS LAST");
    expect(sql.sql).toContain("resolved_author_reply_at > t.author_reply_seen_at");
    expect(sql.sql).not.toContain(search); expect(sql.values).toContain(search);
    expect(sql.values).toContain("General Inquiry"); expect(sql.values).toContain("HIGH");
    expect(sql.values.slice(-2)).toEqual([20, 20]);
  });
});
