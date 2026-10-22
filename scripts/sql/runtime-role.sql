-- Run in the selected hosted Supabase SQL editor AFTER migrations, as a trusted owner.
-- This file deliberately does not set/reset passwords. For a NEW runtime role only,
-- set a random password in a trusted session and store it outside source control:
-- ALTER ROLE bookleaf_runtime PASSWORD '<new randomly generated password>';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bookleaf_runtime') THEN
    CREATE ROLE bookleaf_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

GRANT CONNECT ON DATABASE postgres TO bookleaf_runtime;
GRANT USAGE ON SCHEMA app TO bookleaf_runtime;
GRANT USAGE ON TYPE app."Role", app."TicketStatus", app."TicketPriority", app."TicketCategory", app."AiStatus", app."AiProvider", app."TicketEventType" TO bookleaf_runtime;
GRANT SELECT ON app.users, app.author_profiles, app.books TO bookleaf_runtime;
GRANT SELECT, INSERT, UPDATE ON app.tickets TO bookleaf_runtime;
GRANT SELECT, INSERT ON app.ticket_messages, app.ticket_notes, app.ticket_events TO bookleaf_runtime;

-- No runtime role changes, imports, DDL, deletions or audit rewrites.
-- Provisioning uses separate trusted credentials in Milestone 2.
-- Rerun explicit grants when later migrations add tables.
