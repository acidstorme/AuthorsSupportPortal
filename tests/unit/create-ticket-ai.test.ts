import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Principal } from "../../src/server/auth/policy";
const mocks = vi.hoisted(() => ({ create: vi.fn(), classify: vi.fn() }));
vi.mock("../../src/server/services/tickets", () => ({ createTicket: mocks.create }));
vi.mock("../../src/server/services/ai", () => ({ classifyPersistedTicket: mocks.classify }));
import { createTicketWithAI } from "../../src/server/services/create-ticket-with-ai";
beforeEach(() => { vi.resetAllMocks(); mocks.create.mockResolvedValue({ ticket: { id: "persisted" }, replayed: false }); });
describe("ticket persistence before best-effort awaited AI", () => {
  it("returns a saved ticket even when AI fails and does not retry idempotent creation", async () => {
    mocks.classify.mockRejectedValue(new Error("AI down"));
    const result = await createTicketWithAI({} as Principal, { subject: "Help", description: "Query", bookId: null, requestId: "request" });
    expect(result.ticket.id).toBe("persisted");
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.classify.mock.invocationCallOrder[0]);
    mocks.create.mockResolvedValue({ ...result, replayed: true });
    await createTicketWithAI({} as Principal, { subject: "Help", description: "Query", bookId: null, requestId: "request" });
    expect(mocks.classify).toHaveBeenCalledOnce();
  });
});
