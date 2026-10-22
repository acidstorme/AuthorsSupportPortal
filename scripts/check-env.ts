import { z } from "zod";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseMigrationEnv, parseRuntimeEnv } from "../src/server/config/env-schema";

loadProjectEnv();
try {
  const args = process.argv.slice(2);
  const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : args[0];
  const env = args.length ? parseMigrationEnv(process.env, target) : parseRuntimeEnv(process.env);
  console.log(`Environment configuration valid for ${env.APP_ENV}; AI mode: ${env.AI_MODE}.`);
  console.log("Configuration validation only. No database, Auth, or OpenAI connection was attempted.");
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid environment variables:");
    for (const issue of error.issues) console.error(`- ${issue.path.join(".") || "DIRECT_URL"}: ${issue.message}`);
  } else console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
