# Planned integration tests

M2 deterministic tests exercise provisioning/seed orchestration with in-memory adapters. They do not prove real PostgreSQL constraints or Supabase behavior. The real setup verifier and HTTP harness remain safety-gated. Use a separate explicitly approved hosted test project for destructive fixtures; never reset demo data. Ticket transaction tests are deferred.
