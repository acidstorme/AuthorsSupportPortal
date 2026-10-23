import { describe, expect, it } from "vitest";
import { parseDemoEnv, parseRuntimeEnv } from "../../src/server/config/env-schema";

const ref = "abcdefghijklmnopqrst";
function fixture(): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", APP_ENV: "development", APP_URL: "http://localhost:3000", SUPABASE_PROJECT_REF: ref,
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unit_fixture_value",
    DATABASE_URL: `postgresql://bookleaf_runtime.${ref}:fixture@aws-0-region.pooler.supabase.com:6543/postgres?schema=app&sslmode=verify-full`,
    DIRECT_URL: `postgresql://postgres.${ref}:fixture@aws-0-region.pooler.supabase.com:5432/postgres?schema=app&sslmode=verify-full`,
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_unit_fixture_value", DEMO_AUTHOR_PASSWORD: "fixture-author", DEMO_ADMIN_PASSWORD: "fixture-admin",
    DEMO_ADMIN1_EMAIL: "admin1@email.com", DEMO_ADMIN2_EMAIL: "admin2@email.com", DEMO_APPROVED_PROJECT_REF: ref, DEMO_EMAIL_DISABLED_CONFIRMED: "true", AI_MODE: "mock" };
}
describe("privileged demo setup safeguards", () => {
  it("requires a matching explicitly approved project and verified email acknowledgement", () => {
    expect(parseDemoEnv(fixture(), "development").DEMO_ADMIN1_EMAIL).toBe("admin1@email.com");
    expect(() => parseDemoEnv({ ...fixture(), DEMO_APPROVED_PROJECT_REF: "xxxxxxxxxxxxxxxxxxxx" }, "development")).toThrow("not approved");
    expect(() => parseDemoEnv({ ...fixture(), DEMO_EMAIL_DISABLED_CONFIRMED: "false" }, "development")).toThrow();
    expect(() => parseDemoEnv(fixture(), "demo")).toThrow("target");
  });
  it("rejects duplicate admin emails, absent keys, and unrelated legacy project keys", () => {
    expect(() => parseDemoEnv({ ...fixture(), DEMO_ADMIN2_EMAIL: "admin1@email.com" }, "development")).toThrow("distinct");
    expect(() => parseDemoEnv({ ...fixture(), SUPABASE_SERVICE_ROLE_KEY: "" }, "development")).toThrow();
    const payload = Buffer.from(JSON.stringify({ role: "service_role", ref: "xxxxxxxxxxxxxxxxxxxx" })).toString("base64url");
    expect(() => parseDemoEnv({ ...fixture(), SUPABASE_SERVICE_ROLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture` }, "development")).toThrow("approved project");
  });
  it("rejects owner credentials in the web runtime", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), DATABASE_URL: fixture().DATABASE_URL!.replace("bookleaf_runtime.", "postgres.") })).toThrow();
  });
  it("still requires restricted runtime configuration for provisioning after migration validation succeeds", () => {
    for (const DATABASE_URL of [undefined, "replace-me", fixture().DATABASE_URL!.replace("bookleaf_runtime.", "postgres.")]) {
      expect(() => parseDemoEnv({ ...fixture(), DATABASE_URL }, "development")).toThrow();
    }
  });
});
