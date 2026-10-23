import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ principal: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock("../../src/server/auth/current-user", () => ({ getCurrentPrincipal: mocks.principal }));
vi.mock("../../src/server/services/auth", () => ({ login: mocks.login, logout: mocks.logout }));
import { GET as me } from "../../src/app/api/me/route";
import { GET as admin } from "../../src/app/api/admin/overview/route";
import { POST as login } from "../../src/app/api/auth/login/route";
import { POST as logout } from "../../src/app/api/auth/logout/route";

describe("HTTP route handlers (mocked integration boundaries)", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); });
  afterEach(() => vi.unstubAllEnvs());
  it("returns 401 for unauthenticated me and admin calls", async () => {
    mocks.principal.mockResolvedValue(null);
    expect((await me()).status).toBe(401); expect((await admin()).status).toBe(401);
  });
  it("enforces identical admin-only access for both admins and denies an author", async () => {
    mocks.principal.mockResolvedValue({ role: "AUTHOR" }); expect((await admin()).status).toBe(403);
    for (const email of ["admin1@email.com", "admin2@email.com"]) {
      mocks.principal.mockResolvedValue({ id: email, email, role: "ADMIN", authorId: null });
      const response = await admin(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it("rejects cross-origin mutations before touching authentication", async () => {
    const response = await login(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: "{}" }));
    expect(response.status).toBe(403); expect(mocks.login).not.toHaveBeenCalled();
    expect((await logout(new Request("http://localhost:3000/api/auth/logout", { method: "POST" }))).status).toBe(403);
  });
  it("returns standard validation and malformed JSON errors", async () => {
    const request = (body: string) => new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body });
    expect((await login(request("{"))).status).toBe(400);
    const response = await login(request(JSON.stringify({ email: "priya.sharma@email.com", password: "fixture", role: "ADMIN" })));
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe("VALIDATION_ERROR"); expect(mocks.login).not.toHaveBeenCalled();
  });
  it("returns explicit login redirect and 204 logout without exposing credentials", async () => {
    mocks.login.mockResolvedValue({ user: { role: "AUTHOR" }, redirectTo: "/author" });
    const response = await login(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ email: "priya.sharma@email.com", password: "fixture" }) }));
    expect(response.status).toBe(200); expect((await response.json()).data.redirectTo).toBe("/author");
    expect((await logout(new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { Origin: "http://localhost:3000" } }))).status).toBe(204);
  });
});
