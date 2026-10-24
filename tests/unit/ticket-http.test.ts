import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ principal: vi.fn(), list: vi.fn(), find: vi.fn(), findCreation: vi.fn(), ownsBook: vi.fn(), create: vi.fn(), messages: vi.fn(), reply: vi.fn() }));
vi.mock("../../src/server/auth/current-user", () => ({ getCurrentPrincipal: mocks.principal }));
vi.mock("../../src/server/repositories/tickets", () => ({ ticketsRepository: mocks }));
vi.mock("../../src/server/services/ai", () => ({ classifyPersistedTicket: vi.fn() }));
import { GET as list, POST as create } from "../../src/app/api/tickets/route";
import { GET as detail } from "../../src/app/api/tickets/[ticketId]/route";
import { GET as messages, POST as reply } from "../../src/app/api/tickets/[ticketId]/messages/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ ticketId: id }) };
const url = "http://localhost:3000/api/tickets";
function post(body: unknown, origin = "http://localhost:3000") { return new Request(url, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
const input = { subject: "Help", description: "Question", bookId: null, requestId: id };
const ticket = { ...input, id, authorId: "AUTH001", status: "OPEN", createdAt: new Date(), updatedAt: new Date(), draftText: "PRIVATE", manualCategory: null, aiCategory: null, manualPriority: null, aiPriority: null };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); mocks.principal.mockResolvedValue({ id: "author", role: "AUTHOR", authorId: "AUTH001" }); mocks.find.mockResolvedValue(ticket); mocks.findCreation.mockResolvedValue(null); mocks.create.mockResolvedValue(ticket); });
afterEach(() => vi.unstubAllEnvs());
describe("ticket HTTP handlers with real validation/services and mocked repository", () => {
  it("returns 401 for all anonymous ticket endpoints", async () => {
    mocks.principal.mockResolvedValue(null);
    for (const response of [await list(new Request(url)), await create(post(input)), await detail(new Request(url), context), await messages(new Request(url), context), await reply(post({ body: "Hi", requestId: id }), context)]) expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.reply).not.toHaveBeenCalled();
  });
  it("returns 201 on creation, 200 on replay and 409 for conflicting retries", async () => {
    expect((await create(post(input))).status).toBe(201);
    mocks.findCreation.mockResolvedValue(ticket);
    expect((await create(post(input))).status).toBe(200);
    expect((await create(post({ ...input, subject: "Changed" }))).status).toBe(409);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("rejects impersonation, unowned books, cross-origin requests and invalid pagination", async () => {
    expect((await create(post({ ...input, authorId: "AUTH002" }))).status).toBe(422);
    mocks.ownsBook.mockResolvedValue(false);
    expect((await create(post({ ...input, bookId: "BOOK003" }))).status).toBe(422);
    expect((await create(post(input, "https://attacker.invalid"))).status).toBe(403);
    expect((await list(new Request(`${url}?pageSize=101`))).status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("hides foreign ticket existence and excludes private data from public detail", async () => {
    const response = await detail(new Request(url), context);
    expect(response.status).toBe(200); expect(await response.text()).not.toContain("PRIVATE");
    expect(response.headers.get("cache-control")).toContain("no-store");
    mocks.find.mockResolvedValue(null);
    expect((await detail(new Request(url), context)).status).toBe(404);
    expect((await reply(post({ body: "Hi", requestId: id }), context)).status).toBe(404);
  });
  it("serializes messages without exposing sender identifiers or request IDs", async () => {
    mocks.messages.mockResolvedValue({ messages: [{ id, body: "Hi", senderId: "private-id", clientRequestId: "private-request", sender: { displayName: "Support", role: "ADMIN" }, createdAt: new Date() }], total: 1 });
    const response = await messages(new Request(`${url}?page=1&pageSize=20`), context);
    const text = await response.text(); expect(text).toContain("Support"); expect(text).not.toContain("private-");
    expect(mocks.messages).toHaveBeenCalledWith(id, { page: 1, pageSize: 20 });
  });
});
