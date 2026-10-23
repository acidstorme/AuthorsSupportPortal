import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = fileURLToPath(new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url));
const project = "abcdefghijklmnopqrst";
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  SUPABASE_PROJECT_REF: project,
  NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_for_cli_tests",
  DATABASE_URL: `postgresql://bookleaf_runtime.${project}:fixture-secret@aws-0-region.pooler.supabase.com:6543/postgres?schema=app&sslmode=verify-full`,
  DIRECT_URL: `postgresql://postgres.${project}:fixture-secret@aws-0-region.pooler.supabase.com:5432/postgres?schema=app&sslmode=verify-full`,
  AI_MODE: "mock",
};

describe("standalone environment CLI", () => {
  it("loads the same env module in native ESM and validates without exposing credentials", () => {
    const result = spawnSync(process.execPath, [cli, "scripts/check-env.ts", "development"], { cwd: root, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Configuration validation only");
    expect(result.stdout + result.stderr).not.toContain("fixture-secret");
  });
  it("stops a wrong-target migration before invoking Prisma or making connections", () => {
    const result = spawnSync(process.execPath, [cli, "scripts/migrate.ts", "demo"], { cwd: root, env, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("matching APP_ENV");
    expect(result.stdout).not.toContain("Prisma migration");
    expect(result.stdout + result.stderr).not.toContain("fixture-secret");
  });
  it("validates bootstrap settings without runtime, Auth or AI credentials", () => {
    const bootstrap = { ...env, DATABASE_URL: undefined, APP_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, AI_MODE: "openai", OPENAI_API_KEY: undefined };
    const result = spawnSync(process.execPath, [cli, "scripts/check-env.ts", "development"], { cwd: root, env: bootstrap, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Migration environment configuration valid");
    expect(result.stdout).toContain("runtime credentials are not required");
    expect(result.stdout + result.stderr).not.toContain("fixture-secret");
    const runtime = spawnSync(process.execPath, [cli, "scripts/check-env.ts"], { cwd: root, env: bootstrap, encoding: "utf8" });
    expect(runtime.status).toBe(1);
    expect(runtime.stderr).toContain("DATABASE_URL");
  });
});
