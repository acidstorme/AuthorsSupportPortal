import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), getUser: vi.fn(), signOut: vi.fn(), findById: vi.fn(), clear: vi.fn(), hasCookie: vi.fn() }));
vi.mock("../../src/server/auth/supabase", () => ({ createRouteSupabaseClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword, getUser: mocks.getUser, signOut: mocks.signOut } }), clearSessionCookies: mocks.clear, hasSessionCookie: mocks.hasCookie }));
vi.mock("../../src/server/repositories/users", () => ({ usersRepository: { findById: mocks.findById } }));
import { login, logout } from "../../src/server/services/auth";

describe("authentication service (mocked Supabase transport)", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.hasCookie.mockResolvedValue(true); mocks.signInWithPassword.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "uuid", email: "priya.sharma@email.com", user_metadata: { role: "ADMIN" } } }, error: null });
    mocks.findById.mockResolvedValue({ id: "uuid", role: "AUTHOR", loginEmail: "priya.sharma@email.com", displayName: "Priya", authorProfile: { authorId: "AUTH001" } });
  });
  it("verifies the signed-in identity and returns a role redirect without tokens", async () => {
    const result = await login("priya.sharma@email.com", "fixture-password");
    expect(mocks.getUser).toHaveBeenCalled();
    expect(result).toMatchObject({ redirectTo: "/author", user: { role: "AUTHOR" } });
    expect(JSON.stringify(result)).not.toContain("fixture-password");
    expect(result).not.toHaveProperty("session");
  });
  it("signs out and clears cookies when a valid Auth user has no app access", async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(login("priya.sharma@email.com", "fixture-password")).rejects.toMatchObject({ status: 403 });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }); expect(mocks.clear).toHaveBeenCalled();
  });
  it("uses a generic login error without leaking provider details", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { status: 400, message: "private provider details" } });
    await expect(login("priya.sharma@email.com", "wrong")).rejects.toMatchObject({ status: 401, code: "LOGIN_FAILED" });
    expect(mocks.findById).not.toHaveBeenCalled();
  });
  it("revokes the refresh session and always clears local cookies on logout", async () => {
    await logout(); expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }); expect(mocks.clear).toHaveBeenCalled();
    mocks.signOut.mockResolvedValue({ error: { status: 500 } });
    await expect(logout()).rejects.toMatchObject({ status: 503 }); expect(mocks.clear).toHaveBeenCalledTimes(2);
  });
  it("handles already signed-out requests without database access", async () => {
    mocks.hasCookie.mockResolvedValue(false); await logout();
    expect(mocks.signOut).not.toHaveBeenCalled(); expect(mocks.clear).toHaveBeenCalled();
  });
});
