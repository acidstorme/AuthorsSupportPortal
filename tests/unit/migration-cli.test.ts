import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));
vi.mock("../../src/server/config/load-env", () => ({ loadProjectEnv: () => undefined }));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const project = "abcdefghijklmnopqrst";
const direct = `postgresql://postgres.${project}:fixture-secret@aws-0-region.pooler.supabase.com:5432/postgres?schema=app&sslmode=verify-full`;

describe("migration CLI bootstrap (mocked Prisma executor; no database writes)", () => {
  beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("APP_ENV", "development"); vi.stubEnv("SUPABASE_PROJECT_REF", project); vi.stubEnv("DIRECT_URL", direct);
    vi.stubEnv("DATABASE_URL", undefined); vi.stubEnv("APP_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("AI_MODE", "openai"); vi.stubEnv("OPENAI_API_KEY", undefined);
    process.argv = [process.execPath, "scripts/migrate.ts", "development"];
    process.exitCode = undefined;
    mocks.spawn.mockReturnValue({ status: 0 });
  });
  afterEach(() => {
    process.argv = originalArgv; process.exitCode = originalExitCode;
    vi.unstubAllEnvs(); vi.restoreAllMocks();
  });
  it("invokes migrate deploy using DIRECT_URL before runtime credentials exist", async () => {
    await import("../../scripts/migrate");
    expect(mocks.spawn).toHaveBeenCalledOnce();
    expect(mocks.spawn.mock.calls[0][1]).toEqual([expect.stringContaining("prisma"), "migrate", "deploy"]);
    expect(mocks.spawn.mock.calls[0][2].env.DIRECT_URL).toBe(direct);
    expect(process.exitCode).toBe(0);
  });
  it("keeps read-only status available during bootstrap", async () => {
    process.argv.push("--status");
    await import("../../scripts/migrate");
    expect(mocks.spawn.mock.calls[0][1]).toEqual([expect.stringContaining("prisma"), "migrate", "status"]);
  });
  it("rejects wrong environment and never invokes Prisma", async () => {
    process.argv = [process.execPath, "scripts/migrate.ts", "demo"];
    await import("../../scripts/migrate");
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
  });
  it("rejects a different project before invoking Prisma", async () => {
    vi.stubEnv("DIRECT_URL", direct.replace(project, "xxxxxxxxxxxxxxxxxxxx"));
    await import("../../scripts/migrate");
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
  });
});
