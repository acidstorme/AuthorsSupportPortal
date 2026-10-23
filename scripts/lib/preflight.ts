import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { parseDemoEnv } from "../../src/server/config/env-schema";
import { Pool } from "pg";

export function migrationChecksums(sql: string) {
  const lf = sql.replace(/\r\n/g, "\n");
  return new Set([sql, lf, lf.replace(/\n/g, "\r\n")].map((value) => createHash("sha256").update(value).digest("hex")));
}

export async function assertMigrations(db: PrismaClient) {
  const migrations = await db.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, checksum, finished_at, rolled_back_at FROM app._prisma_migrations`;
  if (migrations.some((migration) => !migration.finished_at && !migration.rolled_back_at)) throw new Error("A failed or in-progress migration requires attention before provisioning.");
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  for (const item of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const checksums = migrationChecksums(readFileSync(new URL(`${item.name}/migration.sql`, directory), "utf8"));
    if (!migrations.some((migration) => migration.migration_name === item.name && migration.finished_at && !migration.rolled_back_at && checksums.has(migration.checksum))) throw new Error("Committed migrations are pending or their checksums differ. Run db:status/db:migrate for the approved target; never reset demo data.");
  }
}

export async function assertSignupDisabled(env: ReturnType<typeof parseDemoEnv>) {
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Cannot read hosted Auth settings. No demo accounts were created.");
  const settings = await response.json() as { disable_signup?: boolean };
  if (settings.disable_signup !== true) throw new Error("Disable public signup in hosted Supabase before demo provisioning.");
}

export async function assertRuntimeAndEmailSafety(db: PrismaClient, env: ReturnType<typeof parseDemoEnv>) {
  const hooks = await db.$queryRaw<{ prosrc: string; allowed: boolean }[]>`SELECT p.prosrc, (has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') AND has_schema_privilege('supabase_auth_admin', n.oid, 'USAGE')) AS allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='block_demo_auth_email' AND pg_get_function_identity_arguments(p.oid)='event jsonb'`;
  const expectedBody = readFileSync(new URL("../sql/block-auth-emails.sql", import.meta.url), "utf8").split("$block$")[1].trim();
  if (hooks.length !== 1 || !hooks[0].allowed || hooks[0].prosrc.trim() !== expectedBody) throw new Error("Install the reviewed email-blocking SQL function and enable it as Send Email hook before provisioning. Keep the email acknowledgement false until dashboard activation is verified.");
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 10_000 });
  try {
    const result = await pool.query("SELECT current_user = 'bookleaf_runtime' AS identity_ok, has_table_privilege(current_user, 'app.users', 'SELECT') AS read_ok, has_table_privilege(current_user, 'app.books', 'SELECT') AS books_ok, has_table_privilege(current_user, 'app.users', 'UPDATE') AS can_modify_users, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user");
    const row = result.rows[0];
    if (!row?.identity_ok || !row.read_ok || !row.books_ok || row.can_modify_users || row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.rolbypassrls) throw new Error("Restricted runtime role is missing, misconfigured or overprivileged. Review runtime-role.sql before provisioning.");
  } finally { await pool.end(); }
}
