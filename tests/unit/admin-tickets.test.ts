import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Principal } from "../../src/server/auth/policy";
import type { AdminTicket, AdminTicketsRepository } from "../../src/server/repositories/admin-tickets";
import { adminDetail, adminHistory, adminMutation, adminQueue, adminTicketDto } from "../../src/server/services/admin-tickets";
import { adminQueueSchema, updateTicketSchema, acknowledgeSchema } from "../../src/server/validation/admin-tickets";
const author = { id: "author", role: "AUTHOR", authorId: "AUTH001" } as Principal;
const admin = { id: "admin", role: "ADMIN", authorId: null } as Principal;
const ticket = { id: "ticket", subject: "Question", description: "Help", bookId: null, status: "RESOLVED", manualCategory: null, aiCategory: null, manualPriority: "HIGH", aiPriority: "LOW", aiStatus: "PENDING", createdAt: new Date(), updatedAt: new Date(), resolvedAuthorReplyAt: new Date(), authorReplySeenAt: null, author: { authorId: "AUTH001", name: "Author", email: "a@example.test" }, book: null, assignedTo: null, draftText: "PRIVATE_DRAFT" } as unknown as AdminTicket;
const repo = { queue: vi.fn(), find: vi.fn(), notes: vi.fn(), events: vi.fn(), mutate: vi.fn() } satisfies AdminTicketsRepository;
beforeEach(() => { vi.resetAllMocks(); repo.find.mockResolvedValue(ticket); repo.mutate.mockResolvedValue(ticket); });
describe("admin ticket services", () => {
  it("rejects authors before any admin repository access", async () => {
    await expect(adminQueue(author, adminQueueSchema.parse({}), repo)).rejects.toMatchObject({ status: 403 });
    await expect(adminDetail(author, "ticket", repo)).rejects.toMatchObject({ status: 403 });
    await expect(adminHistory(author, "ticket", "notes", { page: 1, pageSize: 20 }, repo)).rejects.toMatchObject({ status: 403 });
    await expect(adminMutation(author, "ticket", { kind: "update", input: { status: "CLOSED" } }, repo)).rejects.toMatchObject({ status: 403 });
    expect(repo.find).not.toHaveBeenCalled(); expect(repo.mutate).not.toHaveBeenCalled(); expect(repo.queue).not.toHaveBeenCalled();
  });
  it("passes queue filters and trusted actor without supplied role/author IDs", async () => {
    const query = adminQueueSchema.parse({ assignment: "mine", attention: "unseen", priority: "HIGH", category: "GENERAL_INQUIRY", sort: "priority_desc", page: "2" });
    repo.queue.mockResolvedValue({ tickets: [ticket], total: 22 });
    const result = await adminQueue(admin, query, repo);
    expect(repo.queue).toHaveBeenCalledWith(query, "admin"); expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 22 });
    expect(result.data[0]).toMatchObject({ needsAttention: true, priority: "HIGH" });
  });
  it("supports either admin equally but only self-assignment", async () => {
    for (const id of ["admin-one", "admin-two"]) await adminMutation({ ...admin, id }, "ticket", { kind: "assignment", assignee: id }, repo);
    await expect(adminMutation(admin, "ticket", { kind: "assignment", assignee: "other" }, repo)).rejects.toMatchObject({ status: 403 });
  });
  it("does not serialize AI draft/error fields and calculates acknowledgement state", () => {
    expect(JSON.stringify(adminTicketDto(ticket))).not.toContain("PRIVATE_DRAFT");
    expect(adminTicketDto({ ...ticket, authorReplySeenAt: ticket.resolvedAuthorReplyAt }).needsAttention).toBe(false);
    expect(adminTicketDto({ ...ticket, resolvedAuthorReplyAt: null }).needsAttention).toBe(false);
  });
  it("returns 404 before history lookup and explicit note DTOs", async () => {
    repo.find.mockResolvedValueOnce(null);
    await expect(adminHistory(admin, "missing", "events", { page: 1, pageSize: 20 }, repo)).rejects.toMatchObject({ status: 404 });
    expect(repo.events).not.toHaveBeenCalled();
    repo.notes.mockResolvedValue({ data: [{ id: "note", body: "Private", creator: { displayName: "Admin" }, creatorId: "SECRET_ID", createdAt: new Date() }], total: 1 });
    expect(JSON.stringify(await adminHistory(admin, "ticket", "notes", { page: 1, pageSize: 20 }, repo))).not.toContain("SECRET_ID");
  });
  it("strictly validates manual changes, empty updates, acknowledgement and queue bounds", () => {
    expect(updateTicketSchema.parse({ manualCategory: null, manualPriority: "CRITICAL" })).toEqual({ manualCategory: null, manualPriority: "CRITICAL" });
    for (const input of [{}, { aiPriority: "LOW" }, { assignedToId: "other" }, { status: "REOPENED" }]) expect(updateTicketSchema.safeParse(input).success).toBe(false);
    expect(acknowledgeSchema.safeParse({ observedReplyAt: "not-a-date" }).success).toBe(false);
    expect(adminQueueSchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(adminQueueSchema.safeParse({ authorId: "AUTH001" }).success).toBe(false);
  });
});
