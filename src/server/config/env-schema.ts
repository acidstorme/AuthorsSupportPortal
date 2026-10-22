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
  AI_MODE: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
}).superRefine((env, ctx) => {
  if (safeUrl(env.NEXT_PUBLIC_SUPABASE_URL)?.hostname !== `${env.SUPABASE_PROJECT_REF}.supabase.co`) {
    ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Auth URL must match SUPABASE_PROJECT_REF" });
  }
  if (!databaseMatchesProject(env.DATABASE_URL, env.SUPABASE_PROJECT_REF)) {
    ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Database must match SUPABASE_PROJECT_REF" });
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

export function parseMigrationEnv(source: NodeJS.ProcessEnv, target: string | undefined) {
  const runtime = parseRuntimeEnv(source);
  const directUrl = databaseUrlSchema.parse(source.DIRECT_URL);
  if (target !== runtime.APP_ENV) throw new Error("Pass an explicit target matching APP_ENV (development, demo, or test).");
  if (!databaseMatchesProject(directUrl, runtime.SUPABASE_PROJECT_REF)) throw new Error("DIRECT_URL does not match SUPABASE_PROJECT_REF.");
  if (new URL(directUrl).hostname.endsWith(".pooler.supabase.com") && new URL(directUrl).port === "6543") {
    throw new Error("DIRECT_URL must use a direct or session connection, not the transaction pooler on port 6543.");
  }
  return { ...runtime, DIRECT_URL: directUrl };
}
