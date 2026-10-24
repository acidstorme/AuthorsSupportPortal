import { z } from "zod";
import { nonPlaceholder, publicEnvSchema, safeUrl } from "../../shared/config/public-env-schema";

const databaseUrlSchema = nonPlaceholder.refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      Boolean(url.username && url.password) && url.searchParams.get("schema") === "app" &&
      url.searchParams.get("sslmode") === "verify-full";
  } catch { return false; }
}, "Use a PostgreSQL URL with credentials, schema=app and sslmode=verify-full");

export const runtimeEnvSchema = publicEnvSchema.extend({
  APP_ENV: z.enum(["development", "demo", "test"]),
  APP_URL: z.url(),
  SUPABASE_PROJECT_REF: z.string().regex(/^[a-z]{20}$/, "Expected a 20-letter hosted project reference"),
  DATABASE_URL: databaseUrlSchema,
  DATABASE_CA_CERT: z.string().optional(),
  AI_MODE: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).max(100).default("gpt-4o-mini"),
}).superRefine((env, ctx) => {
  if (safeUrl(env.NEXT_PUBLIC_SUPABASE_URL)?.hostname !== `${env.SUPABASE_PROJECT_REF}.supabase.co`) {
    ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Auth URL must match SUPABASE_PROJECT_REF" });
  }
  if (!databaseMatchesProject(env.DATABASE_URL, env.SUPABASE_PROJECT_REF)) {
    ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Database must match SUPABASE_PROJECT_REF" });
  }
  const databaseUser = safeUrl(env.DATABASE_URL)?.username;
  if (databaseUser !== "bookleaf_runtime" && databaseUser !== `bookleaf_runtime.${env.SUPABASE_PROJECT_REF}`) {
    ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Runtime connection must use bookleaf_runtime, not the database owner" });
  }
  if (env.AI_MODE === "openai" && (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes("replace-me"))) {
    ctx.addIssue({ code: "custom", path: ["OPENAI_API_KEY"], message: "Required for AI_MODE=openai" });
  }
  if (env.APP_ENV === "demo" && safeUrl(env.APP_URL)?.protocol !== "https:") {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Deployed demo must use HTTPS" });
  }
});

export function databaseMatchesProject(value: string, projectRef: string) {
  try {
    const url = new URL(value);
    return url.hostname === `db.${projectRef}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${projectRef}`));
  } catch { return false; }
}

export function parseRuntimeEnv(source: NodeJS.ProcessEnv) {
  return runtimeEnvSchema.parse(source);
}
// Auth/database must remain available when optional AI configuration is broken.
// All project, role and TLS checks are retained; these returned AI placeholders
// are never used by the AI provider, which calls parseRuntimeEnv separately.
export function parseCoreEnv(source: NodeJS.ProcessEnv) {
  return runtimeEnvSchema.parse({ ...source, AI_MODE: "mock", OPENAI_MODEL: "core-only", OPENAI_API_KEY: undefined });
}

export function parseMigrationEnv(source: NodeJS.ProcessEnv, target: string | undefined) {
  // Bootstrap must work before the runtime login, Auth configuration or AI keys exist.
  const migration = z.object({
    APP_ENV: z.enum(["development", "demo", "test"]),
    SUPABASE_PROJECT_REF: z.string().regex(/^[a-z]{20}$/, "Expected a 20-letter hosted project reference"),
    DIRECT_URL: databaseUrlSchema,
  }).parse(source);
  if (target !== migration.APP_ENV) throw new Error("Pass an explicit target matching APP_ENV (development, demo, or test).");
  if (!databaseMatchesProject(migration.DIRECT_URL, migration.SUPABASE_PROJECT_REF)) throw new Error("DIRECT_URL does not match SUPABASE_PROJECT_REF.");
  const directUrl = new URL(migration.DIRECT_URL);
  if (directUrl.hostname.endsWith(".pooler.supabase.com") && directUrl.port === "6543") {
    throw new Error("DIRECT_URL must use a direct or session connection, not the transaction pooler on port 6543.");
  }
  return migration;
}

const demoSecretsSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: nonPlaceholder.min(20),
  DEMO_AUTHOR_PASSWORD: z.string().min(8).max(200),
  DEMO_ADMIN1_EMAIL: z.email().transform((value) => value.toLowerCase()),
  DEMO_ADMIN2_EMAIL: z.email().transform((value) => value.toLowerCase()),
  DEMO_ADMIN_PASSWORD: z.string().min(8).max(200),
  DEMO_APPROVED_PROJECT_REF: z.string().regex(/^[a-z]{20}$/),
  DEMO_EMAIL_DISABLED_CONFIRMED: z.literal("true"),
});

export function parseDemoEnv(source: NodeJS.ProcessEnv, target: string | undefined) {
  const migration = parseMigrationEnv(source, target);
  // Provisioning still requires the fully configured restricted runtime and Auth settings.
  const runtime = parseRuntimeEnv(source);
  const demo = demoSecretsSchema.parse(source);
  if (demo.DEMO_APPROVED_PROJECT_REF !== migration.SUPABASE_PROJECT_REF) throw new Error("Demo provisioning is not approved for this project. Set DEMO_APPROVED_PROJECT_REF deliberately.");
  if (demo.DEMO_ADMIN1_EMAIL === demo.DEMO_ADMIN2_EMAIL) throw new Error("The two administrator emails must be distinct.");
  // A legacy JWT embeds its project reference. New sb_secret keys are verified by the Admin API.
  if (demo.SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(demo.SUPABASE_SERVICE_ROLE_KEY.split(".")[1], "base64url").toString("utf8"));
      if (payload.role !== "service_role" || payload.ref !== migration.SUPABASE_PROJECT_REF) throw new Error();
    } catch { throw new Error("The provisioning key must be a service-role key for the approved project."); }
  } else if (!demo.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) throw new Error("Use a trusted Supabase service_role JWT or sb_secret key.");
  return { ...migration, ...runtime, ...demo };
}
