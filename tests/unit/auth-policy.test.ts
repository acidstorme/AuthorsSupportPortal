import { describe, expect, it, vi } from "vitest";
import { authorScope, landingPath, requireAuthenticated, requireRole, resolvePrincipal, type Principal } from "../../src/server/auth/policy";
import { sessionCookieOptions, isSessionCookie } from "../../src/server/auth/cookie-policy";
import { loginSchema } from "../../src/server/validation/login";

const author: Principal = { id: "author-uuid", role: "AUTHOR", authorId: "AUTH001", email: "priya.sharma@email.com", displayName: "Priya Sharma" };
describe("trusted authentication and role policies", () => {
  it("denies missing sessions without querying the database", async () => {
    const repository = { findById: vi.fn() };
    await expect(resolvePrincipal(null, repository)).resolves.toBeNull();
    expect(repository.findById).not.toHaveBeenCalled(); expect(() => requireAuthenticated(null)).toThrow("sign in");
  });
  it("denies valid Auth identities without application mappings", async () => {
    await expect(resolvePrincipal({ id: author.id, email: author.email }, { findById: async () => null })).rejects.toMatchObject({ status: 403, code: "ACCOUNT_NOT_PROVISIONED" });
  });
  it("takes role and author identity from the DB, not Auth metadata or the request", async () => {
    const repository = { findById: vi.fn(async () => ({ id: author.id, role: "AUTHOR" as const, loginEmail: author.email, displayName: author.displayName, authorProfile: { authorId: "AUTH001" } })) };
    const principal = await resolvePrincipal({ id: author.id, email: author.email }, repository);
    expect(principal).toEqual(author); expect(repository.findById).toHaveBeenCalledWith(author.id);
    expect(() => requireRole(principal, "ADMIN")).toThrow("role");
    expect(() => authorScope(author, "AUTH002")).toThrow("administrators");
    expect(authorScope(author)).toBe("AUTH001");
  });
  it("denies stale emails, author-without-profile and admin-with-profile mappings", async () => {
    const base = { id: author.id, role: "AUTHOR" as const, loginEmail: author.email, displayName: "Author", authorProfile: null };
    await expect(resolvePrincipal({ id: author.id, email: "changed@email.com" }, { findById: async () => base })).rejects.toMatchObject({ status: 403 });
    await expect(resolvePrincipal({ id: author.id, email: author.email }, { findById: async () => base })).rejects.toMatchObject({ code: "INVALID_ACCOUNT_MAPPING" });
    await expect(resolvePrincipal({ id: author.id, email: author.email }, { findById: async () => ({ ...base, role: "ADMIN", authorProfile: { authorId: "AUTH001" } }) })).rejects.toMatchObject({ code: "INVALID_ACCOUNT_MAPPING" });
  });
  it("gives both admins identical access and landing paths", () => {
    for (const email of ["admin1@email.com", "admin2@email.com"]) {
      const admin: Principal = { ...author, email, role: "ADMIN", authorId: null };
      expect(requireRole(admin, "ADMIN")).toBe(admin); expect(authorScope(admin, "AUTH002")).toBe("AUTH002");
      expect(landingPath(admin.role)).toBe("/admin");
    }
    expect(landingPath(author.role)).toBe("/author");
  });
  it("sets HTTP-only, same-site cookies and Secure on HTTPS; handles chunked cookies", () => {
    expect(sessionCookieOptions("https://demo.example")).toEqual({ path: "/", httpOnly: true, sameSite: "lax", secure: true });
    expect(sessionCookieOptions("http://localhost:3000").secure).toBe(false);
    expect(isSessionCookie("sb-project-auth-token.0", "project")).toBe(true);
    expect(isSessionCookie("sb-other-auth-token", "project")).toBe(false);
  });
  it("rejects role and sender fields in login requests", () => {
    expect(() => loginSchema.parse({ email: author.email, password: "fixture", role: "ADMIN" })).toThrow();
  });
});
