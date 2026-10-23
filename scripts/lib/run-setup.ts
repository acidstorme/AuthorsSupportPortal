import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadProjectEnv } from "../../src/server/config/load-env";
import { parseDemoEnv } from "../../src/server/config/env-schema";
import { createSetupClients } from "./adapters";
import { loadSource } from "./source";
import { desiredIdentities, preflightInventory, provisionAccounts } from "./provisioning";
import { assertMigrations, assertRuntimeAndEmailSafety, assertSignupDisabled } from "./preflight";
import { seedSource } from "./seed";
import { verifySetup } from "./verify";

export async function runSetup(command: "authors" | "admins" | "seed" | "verify" | "all") {
  loadProjectEnv();
  let clients: ReturnType<typeof createSetupClients> | undefined;
  try {
    const args = process.argv.slice(2);
    const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : args[0];
    const env = parseDemoEnv(process.env, target);
    const data = loadSource();
    const all = desiredIdentities(data, env.DEMO_ADMIN1_EMAIL, env.DEMO_ADMIN2_EMAIL);
    console.log(`Demo ${command}: ${env.APP_ENV} / approved project ${env.SUPABASE_PROJECT_REF}. No emails or password resets will be requested.`);
    await assertSignupDisabled(env);
    if (command === "all") {
      const cli = fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url));
      const result = spawnSync(process.execPath, [cli, "migrate", "deploy"], { stdio: "inherit", env: process.env });
      if (result.error || result.status !== 0) throw new Error("Migration deploy failed; no Auth provisioning was attempted.");
    }
    clients = createSetupClients(env);
    const { db, auth, store } = clients;
    await assertMigrations(db);
    await assertRuntimeAndEmailSafety(db, env);
    await preflightInventory(all, auth, store, env.SUPABASE_PROJECT_REF);
    if (command === "authors" || command === "all") console.log("Author provisioning:", await provisionAccounts({ all, kind: "AUTHOR", password: env.DEMO_AUTHOR_PASSWORD, projectRef: env.SUPABASE_PROJECT_REF, auth, store }));
    if (command === "admins" || command === "all") console.log("Administrator bootstrap:", await provisionAccounts({ all, kind: "ADMIN", password: env.DEMO_ADMIN_PASSWORD, projectRef: env.SUPABASE_PROJECT_REF, auth, store }));
    if (command === "seed" || command === "all") { await seedSource(db, data); console.log("Source import complete: 10 profiles, 18 books; ticket data untouched."); }
    if (command === "verify" || command === "all") console.log("Setup verified:", await verifySetup(db, data, all, auth, store, env.SUPABASE_PROJECT_REF));
    if (command === "authors" || command === "admins") {
      const snapshot = await store.list();
      const count = snapshot.filter((user) => user.role === (command === "authors" ? "AUTHOR" : "ADMIN")).length;
      if (count !== (command === "authors" ? 10 : 2)) throw new Error("Provisioned application role count differs from the expected demo count.");
    }
  } catch (error) {
    if (error instanceof z.ZodError) console.error("Setup configuration invalid. Check these variables:", error.issues.map((issue) => issue.path.join(".") || "DIRECT_URL").join(", "));
    else if (error instanceof Error && error.name === "Error") console.error(error.message);
    else console.error("Setup stopped: database/Auth connection or transaction unavailable. Check environment, migrations, permissions and TLS; retry safely after correcting the cause. Raw credentials/errors are intentionally not logged.");
    process.exitCode = 1;
  } finally { await clients?.db.$disconnect(); }
}
