# Planned integration tests

Deterministic tests exercise provisioning/seed orchestration with in-memory adapters and ticket transaction behavior with mocked Prisma. They do not prove real PostgreSQL constraints or Supabase behavior. npm run test:tickets:hosted -- development checks actual HTTP concurrency and ownership after safety preflight, retaining two labelled tickets/two replies. Agent execution stopped before writes because certificate trust is incomplete. See docs/TESTING.md. Never reset demo data or run these fixtures against real users.
