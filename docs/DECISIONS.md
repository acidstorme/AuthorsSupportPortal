# Decisions

These decisions reflect the final user instructions, superseding the original chat plan where noted. Status distinguishes implemented foundations from intended behavior.

| Decision | Alternatives / rationale | Status |
|---|---|---|
| Next.js modular monolith with Node Route Handlers | Separate Express backend adds deployment/API/session duplication without assignment benefit | Auth/book handlers implemented; tickets pending |
| Hosted Supabase only for local integration | Docker/local Supabase workflow removed by final revision; fewer reviewer prerequisites, but needs internet | Configuration foundation implemented; hosted flow unverified |
| Separate development/demo projects | Shared project risks test/demo contamination; explicit target and project-reference checks reduce mistakes | Guards implemented; projects not supplied |
| Prisma 7 stable line and pg adapter | Avoid a release candidate; matching client/adapter versions and generated client are locked | Implemented, schema validated |
| Node 22.17 tested; Node 24 allowed | Matches available runtime and Prisma/Next requirements; Node 24 remains untested here | Engines and .nvmrc recorded |
| Non-exposed app schema and restricted runtime DB role | Browser table access/RLS through Supabase would duplicate API authorization; Prisma does not inherit end-user identity | Migration/role SQL created, application unverified |
| Supabase Auth UUID is users PK | Avoid parallel identities; external Auth FK enforces mapping without Prisma managing auth tables | Schema/SQL created |
| Application users role plus author_profiles | Client metadata cannot authorize access; role is loaded from the DB after server identity verification | Implemented; hosted verification pending |
| Exact dataset Auth emails | Explicit Milestone 2 approval supersedes aliases; deliverable email.com identities require isolated-project approval and outbound-mail blocking | Implemented in scripts; provisioning not run |
| Two equal ADMIN users without profiles | Trusted bootstrap, no frontend role selection or author promotion | Implemented; hosted verification pending |
| Environment-owned shared demo passwords | Approved disposable Bookleaf123 defaults simplify review; existing passwords never reset | Template/scripts implemented; never for real data |
| Server-only Auth and HTTP-only cookies | Browser SDK needs token access; backend REST preserves the requested token boundary | Browser factory removed; SSR proxy/routes implemented |
| Non-sending PostgreSQL Send Email hook | Confirm-email toggle and omitted reset links do not stop recovery; replacement hook rejects mail without a new service | SQL/diagnostics implemented; activation pending |
| Trusted provisioning marker | Email match alone must not adopt an unrelated identity; Admin-only metadata supports partial-failure recovery | Implemented and locally tested |
| Exact source snapshots, Decimal money, DATE timestamps distinguished | Float money, invented null replacements and accounting reconstruction corrupt evidence | Schema and byte-integrity tests implemented |
| Manual and AI classification stored separately | Single mutable field risks AI overwriting admin judgment | Schema implemented; service logic pending |
| Short awaited classification after commit | Queue disproportionate for MVP; unawaited serverless work unreliable; bounded wait has a latency cost | Planned |
| One persisted draft cache plus context hash | Full draft/version table unnecessary for assignment; cache prevents repeat paid calls | Schema fields created; behavior pending |
| Minimal concurrency controls | Unique request keys and narrow transaction serialization address specific races; no global version framework or attempt table | Constraints created; transaction services pending |
| TanStack Query polling | WebSockets/SSE add infrastructure; 5s detail/15s list is adequate near-real-time | Provider scaffold only |
| Separate public messages/private notes | Visibility flags on one table make accidental disclosure easier | Schema implemented; DTO enforcement pending |
| Grounded proposals for unsupported KB examples | Cannot truthfully assert completed escalation, payout or stock re-sync from this dataset | Approved; prompts pending |
| Fixed KB sections, no vector retrieval | Small fixed KB does not justify embedding infrastructure | Planned |
| R2 attachments later | Actual upload bonus; core takes priority. Supabase Storage explicitly excluded | Honest disabled placeholder; no storage/table |
| Ticket links later | Independent pair table can be added without changing ticket semantics | Documented only |

## Migration policy

Migration validation is independent of runtime validation: only APP_ENV, SUPABASE_PROJECT_REF and DIRECT_URL are required, with explicit matching target, project, credentials, app schema and verified TLS. This permits first-time schema creation before the restricted runtime login exists. Runtime and privileged provisioning retain full runtime validation; owner credentials are never accepted for application access. runtime-role.sql requires the migrated tables/enums, followed by runtime configuration and email-hook setup.

Initial SQL was generated offline from Prisma then augmented with checks, external Auth FK, expression/partial indexes and schema grants. It is not evidence of a successful database deployment. Only reviewed committed migrations go through the target-guarded wrapper; do not use db push/reset against hosted development/demo data. Supabase owns auth schema. Runtime role cannot import users or alter application roles.

## Tooling findings

Milestone 3 needs no schema migration: core tables, request-ID uniqueness, ownership FK and audit fields were included initially. Preserve current runtime grants. Duplicate creation is handled with unique constraints and winner retrieval; replies use a short ticket row lock because status and insertion must be consistent. Public DTOs are explicit allowlists for both roles, keeping notes and future drafts private. Author ticket lists are author-only; the admin queue and lifecycle mutation APIs are Milestone 4. Initial descriptions are not duplicated as reply messages.

Initial npm 11.5.2 installation crashed in its peer resolver. npm 11.21.1 installed successfully. Native Next.js/Vitest operations hit this Windows automation sandbox's filesystem restrictions and passed with elevated execution. These are verification-environment issues, not reasons to weaken application security.

Online npm audit reported five high findings propagated from a dev-only braces/glob dependency through Next ESLint. Latest braces was 3.0.3 with no patched release at check time. Production dependencies audited clean. Do not downgrade the Next lint configuration across major versions merely to silence the advisory; review updates and limit tooling to trusted source patterns. This is a tracked limitation, not a clean full audit claim.
