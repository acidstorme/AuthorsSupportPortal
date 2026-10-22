import { describe, expect, it } from "vitest";
import { parseMigrationEnv, parseRuntimeEnv } from "../../src/server/config/env-schema";
import { z } from "zod";

const project = "abcdefghijklmnopqrst";
function fixture(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    APP_ENV: "development",
    APP_URL: "http://localhost:3000",
    SUPABASE_PROJECT_REF: project,
    NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_for_unit_tests",
    DATABASE_URL: `postgresql://bookleaf_runtime.${project}:fixture@aws-0-region.pooler.supabase.com:6543/postgres?schema=app&sslmode=verify-full`,
    DIRECT_URL: `postgresql://postgres.${project}:fixture@aws-0-region.pooler.supabase.com:5432/postgres?schema=app&sslmode=verify-full`,
    AI_MODE: "mock",
  };
}

describe("environment configuration", () => {
  it("permits deterministic mock configuration without an OpenAI key", () => {
    expect(parseRuntimeEnv(fixture()).AI_MODE).toBe("mock");
  });
  it("requires a key when real AI is explicitly selected", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), AI_MODE: "openai" })).toThrow();
  });
  it("rejects Auth and database project mismatches", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), NEXT_PUBLIC_SUPABASE_URL: "https://xxxxxxxxxxxxxxxxxxxx.supabase.co" })).toThrow();
    expect(() => parseRuntimeEnv({ ...fixture(), DATABASE_URL: fixture().DATABASE_URL!.replace(project, "xxxxxxxxxxxxxxxxxxxx") })).toThrow();
  });
  it("rejects absent app schema or disabled TLS verification", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), DATABASE_URL: fixture().DATABASE_URL!.replace("schema=app", "schema=public") })).toThrow();
    expect(() => parseRuntimeEnv({ ...fixture(), DATABASE_URL: fixture().DATABASE_URL!.replace("verify-full", "disable") })).toThrow();
  });
  it("requires an explicit matching mutation target", () => {
    expect(() => parseMigrationEnv(fixture(), undefined)).toThrow(/target/);
    expect(() => parseMigrationEnv(fixture(), "demo")).toThrow(/target/);
    expect(parseMigrationEnv(fixture(), "development").APP_ENV).toBe("development");
  });
  it("rejects cross-project migration URLs and transaction poolers", () => {
    expect(() => parseMigrationEnv({ ...fixture(), DIRECT_URL: fixture().DIRECT_URL!.replace(project, "xxxxxxxxxxxxxxxxxxxx") }, "development")).toThrow(/match/);
    expect(() => parseMigrationEnv({ ...fixture(), DIRECT_URL: fixture().DATABASE_URL }, "development")).toThrow(/transaction pooler/);
  });
  it("requires HTTPS for deployed demos", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), APP_ENV: "demo" })).toThrow();
  });
  it("returns structured validation errors for malformed URLs", () => {
    expect(() => parseRuntimeEnv({ ...fixture(), NEXT_PUBLIC_SUPABASE_URL: "not-a-url", APP_URL: "invalid", APP_ENV: "demo" })).toThrow(z.ZodError);
  });
});
