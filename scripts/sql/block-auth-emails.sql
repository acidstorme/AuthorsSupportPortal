-- Isolated assignment projects only. This function sends nothing and rejects ALL Auth mail.
-- After running, activate it in Authentication -> Hooks -> Send Email (Postgres function).
-- Installing the function alone does NOT enable the hook.
BEGIN;
DO $prerequisites$
BEGIN
  IF to_regclass('app.users') IS NULL THEN
    RAISE EXCEPTION 'Apply the initial Prisma migration first (npm run db:migrate -- development), then runtime-role.sql, then this email hook SQL.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bookleaf_runtime') THEN
    RAISE EXCEPTION 'Run runtime-role.sql before block-auth-emails.sql.';
  END IF;
END;
$prerequisites$;

CREATE OR REPLACE FUNCTION app.block_demo_auth_email(event jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $block$
  SELECT '{"error":{"http_code":403,"message":"Outbound authentication email is disabled for this isolated demo."}}'::jsonb;
$block$;

REVOKE ALL ON FUNCTION app.block_demo_auth_email(jsonb) FROM PUBLIC, anon, authenticated, bookleaf_runtime;
GRANT USAGE ON SCHEMA app TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION app.block_demo_auth_email(jsonb) TO supabase_auth_admin;
COMMIT;
