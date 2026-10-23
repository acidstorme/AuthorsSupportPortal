import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ticket } from "../../src/generated/prisma/client";
import type { Principal } from "../../src/server/auth/policy";
import type { TicketsRepository } from "../../src/server/repositories/tickets";
import { createTicket, getTicket, listMessages, listTickets, replyToTicket, ticketDto } from "../../src/server/services/tickets";
import { createMessageSchema, createTicketSchema, ticketListSchema } from "../../src/server/validation/tickets";

const author: Principal = { id: "user-a", authorId: "AUTH001", role: "AUTHOR", email: "a@example.test", displayName: "A" };
const admin: Principal = { ...author, id: "admin", role: "ADMIN", authorId: null };
const id = "11111111-1111-4111-8111-111111111111";
const input = { subject: "Question", description: "Help with my book", bookId: null, requestId: id };
const ticket = { id, authorId: "AUTH001", bookId: null, subject: input.subject, description: input.description,
  status: "OPEN", aiCategory: null, aiPriority: null, manualCategory: null, manualPriority: null,
  createdAt: new Date(), updatedAt: new Date(), draftText: "PRIVATE", aiErrorCode: "PRIVATE", notes: ["PRIVATE"] } as unknown as Ticket;
const repo = { list: vi.fn(), find: vi.fn(), findCreation: vi.fn(), ownsBook: vi.fn(), create: vi.fn(), messages: vi.fn(), reply: vi.fn() } satisfies TicketsRepository;
beforeEach(() => { vi.resetAllMocks(); repo.findCreation.mockResolvedValue(null); repo.find.mockResolvedValue(ticket); repo.create.mockResolvedValue(ticket); });
describe("ticket service authorization and contracts", () => {
  it("derives author and actor from the verified principal for general tickets", async () => {
    const result = await createTicket(author, input, repo);
    expect(repo.create).toHaveBeenCalledWith("AUTH001", "user-a", input);
    expect(result.replayed).toBe(false); expect(repo.ownsBook).not.toHaveBeenCalled();
  });
  it("rejects another author's book before writing", async () => {
    repo.ownsBook.mockResolvedValue(false);
    await expect(createTicket(author, { ...input, bookId: "BOOK003" }, repo)).rejects.toMatchObject({ status: 422 });
    expect(repo.ownsBook).toHaveBeenCalledWith("BOOK003", "AUTH001"); expect(repo.create).not.toHaveBeenCalled();
  });
  it("allows owned books and denies admin ticket creation", async () => {
    repo.ownsBook.mockResolvedValue(true);
    await createTicket(author, { ...input, bookId: "BOOK001" }, repo);
    await expect(createTicket(admin, input, repo)).rejects.toMatchObject({ status: 403 });
  });
  it("returns scoped 404 and never reads another author's messages", async () => {
    repo.find.mockResolvedValue(null);
    await expect(listMessages(author, id, { page: 1, pageSize: 20 }, repo)).rejects.toMatchObject({ status: 404 });
    expect(repo.find).toHaveBeenCalledWith(id, "AUTH001"); expect(repo.messages).not.toHaveBeenCalled();
    await expect(replyToTicket(author, id, { body: "Reply", requestId: id }, repo)).rejects.toMatchObject({ status: 404 });
    expect(repo.reply).not.toHaveBeenCalled();
  });
  it("permits an admin to read public detail without exposing private fields", async () => {
    const result = await getTicket(admin, id, repo);
    expect(repo.find).toHaveBeenCalledWith(id, undefined);
    expect(JSON.stringify(result)).not.toContain("PRIVATE"); expect(result).not.toHaveProperty("authorId");
  });
  it("scopes list filters and bounded pagination to the author", async () => {
    repo.list.mockResolvedValue({ tickets: [ticket], total: 4 });
    const query = ticketListSchema.parse({ status: "RESOLVED", page: "2", pageSize: "2", sort: "updated_desc" });
    expect((await listTickets(author, query, repo)).meta).toEqual({ page: 2, pageSize: 2, total: 4 });
    expect(repo.list).toHaveBeenCalledWith("AUTH001", query);
    await expect(listTickets(admin, query, repo)).rejects.toMatchObject({ status: 403 });
  });
  it("replays identical creation and rejects changed content", async () => {
    repo.findCreation.mockResolvedValue(ticket);
    expect((await createTicket(author, input, repo)).replayed).toBe(true);
    await expect(createTicket(author, { ...input, subject: "Changed" }, repo)).rejects.toMatchObject({ status: 409 });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("recovers a concurrent unique-key winner without creating twice", async () => {
    repo.findCreation.mockResolvedValueOnce(null).mockResolvedValueOnce(ticket);
    repo.create.mockRejectedValue({ code: "P2002" });
    expect((await createTicket(author, input, repo)).replayed).toBe(true);
  });
  it("gives manual decisions precedence independently", () => {
    expect(ticketDto({ ...ticket, aiCategory: "GENERAL_INQUIRY", aiPriority: "LOW", manualPriority: "CRITICAL" })).toMatchObject({ category: "GENERAL_INQUIRY", priority: "CRITICAL" });
    expect(ticketDto(ticket)).toMatchObject({ category: null, priority: null });
  });
  it("rejects impersonation, empty input, invalid IDs and excessive pagination", () => {
    for (const extra of [{ authorId: "AUTH002" }, { senderId: "someone" }, { status: "CLOSED" }, { manualPriority: "CRITICAL" }]) expect(createTicketSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: " hi ", requestId: id, senderId: "someone" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...input, description: " " }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: "hi", requestId: "bad" }).success).toBe(false);
    expect(ticketListSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
