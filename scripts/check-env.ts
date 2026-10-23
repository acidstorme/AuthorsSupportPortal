import { z } from "zod";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv, parseMigrationEnv, parseRuntimeEnv } from "../src/server/config/env-schema";

loadProjectEnv();
try {
  const args = process.argv.slice(2);
  const remaining = args.filter((arg) => arg !== "--demo");
  const target = remaining.includes("--target") ? remaining[remaining.indexOf("--target") + 1] : remaining[0];
  const env = args.includes("--demo") ? parseDemoEnv(process.env, target) : remaining.length ? parseMigrationEnv(process.env, target) : parseRuntimeEnv(process.env);
  const scope = args.includes("--demo") ? "Demo setup" : remaining.length ? "Migration" : "Runtime";
  console.log(`${scope} environment configuration valid for ${env.APP_ENV}.`);
  if (scope === "Migration") console.log("Validated DIRECT_URL and explicit target/project only; runtime credentials are not required.");
  console.log("Configuration validation only. No database, Auth, or OpenAI connection was attempted.");
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid environment variables:");
    for (const issue of error.issues) console.error(`- ${issue.path.join(".") || "DIRECT_URL"}: ${issue.message}`);
  } else console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
