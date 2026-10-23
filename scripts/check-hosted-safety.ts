import { Pool } from "pg";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { loadProjectEnv } from "../src/server/config/load-env";
import { databaseMatchesProject } from "../src/server/config/env-schema";

// Read-only diagnostics. Never creates accounts, sends mail or runs setup SQL.
loadProjectEnv();
let pool: Pool | undefined;
let runtime: Pool | undefined;
try {
  const env = z.object({ DIRECT_URL: z.url(), SUPABASE_PROJECT_REF: z.string().regex(/^[a-z]{20}$/), NEXT_PUBLIC_SUPABASE_URL: z.url(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20) }).parse(process.env);
  if (!databaseMatchesProject(env.DIRECT_URL, env.SUPABASE_PROJECT_REF) || new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== `${env.SUPABASE_PROJECT_REF}.supabase.co`) throw new Error("Hosted diagnostics require matching project references.");
  const diagnosticUrl = new URL(env.DIRECT_URL);
  diagnosticUrl.searchParams.set("sslmode", "verify-full");
  pool = new Pool({ connectionString: diagnosticUrl.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
  const { rows } = await pool.query("SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = 'bookleaf_runtime'");
  console.log("Runtime role:", rows[0] ?? "NOT CREATED");
  const tables = await pool.query("SELECT to_regclass('app.users') IS NOT NULL AS application_tables_present");
  console.log("Application tables:", tables.rows[0]);
  const hook = await pool.query("SELECT p.prosrc, has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') AS auth_can_execute, has_schema_privilege('supabase_auth_admin', n.oid, 'USAGE') AS auth_can_use_schema FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='block_demo_auth_email' AND pg_get_function_identity_arguments(p.oid)='event jsonb'");
  const expected = readFileSync(new URL("./sql/block-auth-emails.sql", import.meta.url), "utf8").split("$block$")[1].trim();
  const safe = hook.rows.length === 1 && hook.rows[0].prosrc.trim() === expected && hook.rows[0].auth_can_execute && hook.rows[0].auth_can_use_schema;
  console.log("Reviewed non-sending email hook installed and permitted:", Boolean(safe));
  if (safe) {
    const probe = await pool.query("SELECT app.block_demo_auth_email('{}'::jsonb) AS result");
    console.log("Direct SQL hook check:", probe.rows[0].result?.error?.http_code === 403 ? "PASS: explicit rejection, no SMTP or HTTP call" : "FAIL");
  }
  console.log("Hook ACTIVATION must still be checked in the dashboard; database function existence alone is not proof. Keep DEMO_EMAIL_DISABLED_CONFIRMED=false until activation is verified.");
  const runtimeUrl = process.env.DATABASE_URL;
  if (runtimeUrl && !runtimeUrl.includes("replace-me") && databaseMatchesProject(runtimeUrl, env.SUPABASE_PROJECT_REF)) {
    const runtimeDiagnosticUrl = new URL(runtimeUrl);
    runtimeDiagnosticUrl.searchParams.set("sslmode", "verify-full");
    runtime = new Pool({ connectionString: runtimeDiagnosticUrl.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
    const result = await runtime.query("SELECT current_user = 'bookleaf_runtime' AS restricted_identity, has_table_privilege(current_user, 'app.users', 'SELECT') AS can_read_users, has_table_privilege(current_user, 'app.books', 'SELECT') AS can_read_books, has_table_privilege(current_user, 'app.users', 'UPDATE') AS can_update_users");
    console.log("Runtime connection permissions:", result.rows[0]);
  } else console.log("Runtime connection not tested: DATABASE_URL is incomplete.");
  const settings = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10_000) });
  if (!settings.ok) throw new Error("Auth settings could not be read.");
  const body = await settings.json();
  console.log("Public signup disabled:", body.disable_signup === true);
} catch (error) {
  console.error(error instanceof z.ZodError ? "Hosted diagnostic configuration is incomplete." : error instanceof Error && error.name === "Error" ? error.message : "Hosted diagnostic connection failed. Check the configured direct/session URL, TLS, password and network. No provisioning was attempted.");
  process.exitCode = 1;
} finally { await runtime?.end(); await pool?.end(); }
