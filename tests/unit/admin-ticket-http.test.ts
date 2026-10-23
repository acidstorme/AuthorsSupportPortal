import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ principal: vi.fn(), queue: vi.fn(), find: vi.fn(), notes: vi.fn(), events: vi.fn(), mutate: vi.fn() }));
vi.mock("../../src/server/auth/current-user", () => ({ getCurrentPrincipal: mocks.principal }));
vi.mock("../../src/server/repositories/admin-tickets", () => ({ adminTicketsRepository: mocks }));
import { GET as queue } from "../../src/app/api/admin/tickets/route";
import { GET as detail } from "../../src/app/api/admin/tickets/[ticketId]/route";
import { PATCH as patch } from "../../src/app/api/tickets/[ticketId]/route";
import { PUT as assign, DELETE as unassign } from "../../src/app/api/tickets/[ticketId]/assignment/route";
import { GET as notes, POST as note } from "../../src/app/api/tickets/[ticketId]/notes/route";
import { GET as events } from "../../src/app/api/tickets/[ticketId]/events/route";
import { POST as acknowledge } from "../../src/app/api/tickets/[ticketId]/acknowledge/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ ticketId: id }) };
const ticket = { id, status: "OPEN", bookId: null, subject: "Question", description: "Help", author: { authorId: "AUTH001", name: "A", email: "a@example.test" }, book: null, assignedTo: null, manualCategory: null, manualPriority: null, aiCategory: null, aiPriority: null, aiStatus: "PENDING", createdAt: new Date(), updatedAt: new Date(), resolvedAuthorReplyAt: null, authorReplySeenAt: null };
const request = (body?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/admin/tickets", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); mocks.principal.mockResolvedValue({ id, role: "ADMIN", authorId: null }); mocks.find.mockResolvedValue(ticket); mocks.mutate.mockResolvedValue(ticket); });
afterEach(() => vi.unstubAllEnvs());
describe("admin ticket route authorization and validation", () => {
  it("rejects anonymous and author access across every admin operation", async () => {
    for (const [principal, status] of [[null, 401], [{ role: "AUTHOR", authorId: "AUTH001" }, 403]] as const) {
      mocks.principal.mockResolvedValue(principal);
      const responses = [await queue(request()), await detail(request(), context), await patch(request({ status: "CLOSED" }), context), await assign(request({}), context), await unassign(request(), context), await notes(request(), context), await note(request({ body: "PRIVATE" }), context), await events(request(), context), await acknowledge(request({ observedReplyAt: new Date().toISOString() }), context)];
      for (const response of responses) expect(response.status).toBe(status);
    }
    expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled(); expect(mocks.notes).not.toHaveBeenCalled();
  });
  it("uses same-origin checks and rejects supplied assignees/actors or AI fields", async () => {
    expect((await patch(request({ status: "CLOSED" }, "https://attacker.invalid"), context)).status).toBe(403);
    expect((await assign(request({ assignee: "other" }), context)).status).toBe(422);
    expect((await patch(request({ aiPriority: "LOW" }), context)).status).toBe(422);
    expect((await note(request({ body: "note", creatorId: "other" }), context)).status).toBe(422);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("assigns only the authenticated admin, clears assignment and applies explicit updates", async () => {
    expect((await assign(request({}), context)).status).toBe(200);
    expect(mocks.mutate).toHaveBeenLastCalledWith(id, id, { kind: "assignment", assignee: id });
    expect((await unassign(request(), context)).status).toBe(200);
    expect(mocks.mutate).toHaveBeenLastCalledWith(id, id, { kind: "assignment", assignee: null });
    expect((await patch(request({ status: "IN_PROGRESS", manualPriority: "HIGH" }), context)).status).toBe(200);
    expect(mocks.mutate).toHaveBeenLastCalledWith(id, id, { kind: "update", input: { status: "IN_PROGRESS", manualPriority: "HIGH" } });
  });
  it("returns private paginated history only to admins with no-store headers", async () => {
    mocks.notes.mockResolvedValue({ data: [{ id, body: "PRIVATE", creator: { displayName: "Admin" }, createdAt: new Date() }], total: 1 });
    const response = await notes(request(), context); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).data[0].body).toBe("PRIVATE");
    expect((await note(request({ body: "Private", requestId: id }), context)).status).toBe(201);
    mocks.principal.mockResolvedValue({ role: "AUTHOR" });
    expect((await notes(request(), context)).status).toBe(403);
  });
  it("validates queue parameters, UUIDs and stale acknowledgement errors", async () => {
    expect((await queue(new Request("http://localhost:3000/api/admin/tickets?pageSize=1000"))).status).toBe(422);
    expect((await detail(request(), { params: Promise.resolve({ ticketId: "bad" }) })).status).toBe(422);
    const { AppError } = await import("../../src/server/http/errors");
    mocks.mutate.mockRejectedValue(new AppError(409, "ATTENTION_CHANGED", "Refresh before acknowledging."));
    const response = await acknowledge(request({ observedReplyAt: new Date().toISOString() }), context);
    expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("ATTENTION_CHANGED");
  });
});
