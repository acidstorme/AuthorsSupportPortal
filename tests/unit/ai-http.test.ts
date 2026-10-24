import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ principal: vi.fn(), draft: vi.fn(), classify: vi.fn() }));
vi.mock("../../src/server/auth/current-user", () => ({ getCurrentPrincipal: mocks.principal }));
vi.mock("../../src/server/services/ai", () => ({ draftTicket: mocks.draft, retryClassification: mocks.classify }));
import { POST as draft } from "../../src/app/api/tickets/[ticketId]/draft/route";
import { POST as classify } from "../../src/app/api/tickets/[ticketId]/classification/route";
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ ticketId: id }) };
function request(body: unknown, origin = "http://localhost:3000") { return new Request("http://localhost:3000", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); mocks.principal.mockResolvedValue({ role: "ADMIN" }); mocks.draft.mockResolvedValue({ text: "draft", provider: "MOCK" }); });
afterEach(() => vi.unstubAllEnvs());
describe("AI HTTP transport guards", () => {
  it("denies anonymous/authors before paid-service calls", async () => {
    for (const [principal, status] of [[null, 401], [{ role: "AUTHOR" }, 403]] as const) {
      mocks.principal.mockResolvedValue(principal);
      expect((await draft(request({}), context)).status).toBe(status); expect((await classify(request({}), context)).status).toBe(status);
    }
    expect(mocks.draft).not.toHaveBeenCalled(); expect(mocks.classify).not.toHaveBeenCalled();
  });
  it("requires same origin, strict JSON and valid UUID", async () => {
    expect((await draft(request({}, "https://attacker.invalid"), context)).status).toBe(403);
    expect((await draft(request({ force: true }), context)).status).toBe(422);
    expect((await classify(request({ priority: "LOW" }), context)).status).toBe(422);
    expect((await draft(request({}), { params: Promise.resolve({ ticketId: "bad" }) })).status).toBe(422);
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("uses explicit POST cache/regeneration semantics with private responses", async () => {
    const response = await draft(request({ regenerate: true }), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.draft.mock.calls[0][2]).toBe(true); expect((await response.json()).data.provider).toBe("MOCK");
  });
});
