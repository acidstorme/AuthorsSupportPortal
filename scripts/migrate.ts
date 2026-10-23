import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseMigrationEnv } from "../src/server/config/env-schema";

loadProjectEnv();
try {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf("--target");
  const target = targetIndex < 0 ? args.find((arg) => arg !== "--status") : args[targetIndex + 1];
  const env = parseMigrationEnv(process.env, target);
  console.log(`Prisma migration ${args.includes("--status") ? "status" : "deploy"}: ${env.APP_ENV} / project ${env.SUPABASE_PROJECT_REF}`);
  const cli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "migrate", args.includes("--status") ? "status" : "deploy"], { stdio: "inherit", env: process.env });
  if (result.error) throw new Error("Unable to start Prisma CLI.");
  process.exitCode = result.status ?? 1;
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Migration configuration invalid. Supply APP_ENV, SUPABASE_PROJECT_REF, DIRECT_URL and an explicit matching target. Run npm run env:check -- <target>.");
    console.error(error.issues.map((issue) => issue.path.join(".") || "DIRECT_URL").join(", "));
  } else console.error(error instanceof Error ? error.message : "Migration stopped.");
  process.exitCode = 1;
}
