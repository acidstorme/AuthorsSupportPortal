# Planned integration tests

Deterministic tests exercise provisioning/seed orchestration with in-memory adapters and ticket transaction behavior with mocked Prisma. They do not prove real PostgreSQL constraints or Supabase behavior. npm run test:tickets:hosted -- development checks actual HTTP concurrency and ownership after safety preflight, retaining two labelled tickets/two replies. Agent execution stopped before writes because certificate trust is incomplete. See docs/TESTING.md. Never reset demo data or run these fixtures against real users.

Milestone 4 adds mocked admin mutation/queue tests and npm run test:admin:hosted -- development for real HTTP admin/lifecycle/private-note behavior, including concurrent close/reply. This harness retains a labelled ticket/note/replies/events; its agent attempt stopped at migration verification before writes because certificate trust remains incomplete.
