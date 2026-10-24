import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn(), nextCookies: [] as { name: string; value: string; options: object }[] }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll(values: { name: string; value: string; options: object }[]): void } }) => {
  mocks.create();
  return { auth: { getUser: async () => { mocks.getUser(); options.cookies.setAll(mocks.nextCookies); return { data: { user: { id: "verified" } }, error: null }; } } };
} }));
vi.mock("../../src/server/config/env", () => ({ getCoreServerEnv: () => ({ APP_URL: "https://demo.example", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture" }) }));
import { proxy } from "../../src/proxy";

describe("session refresh proxy (mocked Supabase SDK)", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_PROJECT_REF", "project"); mocks.nextCookies = []; });
  afterEach(() => vi.unstubAllEnvs());
  it("forwards refreshed chunks to the current request and emits HTTP-only secure cookies", async () => {
    mocks.nextCookies = [{ name: "sb-project-auth-token.0", value: "fresh-session", options: { path: "/", httpOnly: false } }, { name: "sb-project-auth-token.1", value: "", options: { maxAge: 0 } }];
    const request = new NextRequest("https://demo.example/author", { headers: { cookie: "sb-project-auth-token.0=old; sb-project-auth-token.1=old-tail" } });
    const response = await proxy(request);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(request.cookies.get("sb-project-auth-token.0")?.value).toBe("fresh-session");
    expect(response.cookies.get("sb-project-auth-token.0")).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", value: "fresh-session" });
    expect(response.cookies.get("sb-project-auth-token.1")?.maxAge).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not refresh on login/logout mutations or requests without session cookies", async () => {
    await proxy(new NextRequest("https://demo.example/login"));
    await proxy(new NextRequest("https://demo.example/api/auth/logout", { headers: { cookie: "sb-project-auth-token=old" } }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
