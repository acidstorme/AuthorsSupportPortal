# Architecture

## Implementation status

Milestone 1 provides schema, migration, environment validation and integration factories. The diagram below describes the approved target architecture. Authentication enforcement, services, repositories and ticket APIs are not implemented yet.

```mermaid
flowchart LR
  UI[Next.js pages / React] --> Q[TanStack Query / REST client]
  Q --> H[Node Route Handlers /api]
  H --> A[Verified Auth identity + application role]
  H --> V[Zod validation]
  A --> S[Business services]
  V --> S
  S --> R[Scoped repositories]
  R --> P[Prisma + pg adapter]
  P --> DB[Hosted Supabase PostgreSQL]
  S --> AI[OpenAI or deterministic mock]
  A --> AUTH[Hosted Supabase Auth]
```

## Boundaries

- `src/app`: routes/pages and transport adapters; Node runtime set at root. No business Route Handlers exist yet.
- `src/components`, `src/features`: presentation, typed REST clients/query hooks. Browser Supabase factory is Auth-only.
- `src/server/auth`: cookie-aware server factory; later verified identity, role and ownership helpers.
- `src/server/services`: lifecycle, authorization-aware orchestration, transactions and audit writes.
- `src/server/repositories`, `src/server/db`: scoped queries and lazy Prisma singleton. `server-only` prevents browser imports.
- `src/server/ai`: later providers, prompts, KB selection and validation.
- `src/shared`: public-safe configuration, DTOs and utilities. Client modules do not import server runtime configuration.
- `scripts`: standalone trusted operations. Next.js environment precedence is shared by scripts and Prisma config.

No unused service/repository abstractions are manufactured. Boundary README files establish the structure until the actual feature is implemented.

## Entity relationships

```mermaid
erDiagram
  AUTH_USERS ||--o| USERS : same_UUID
  USERS ||--o| AUTHOR_PROFILES : has
  AUTHOR_PROFILES ||--o{ BOOKS : owns
  AUTHOR_PROFILES ||--o{ TICKETS : raises
  BOOKS o|--o{ TICKETS : concerns
  USERS o|--o{ TICKETS : assigned_admin
  TICKETS ||--o{ TICKET_MESSAGES : contains
  USERS ||--o{ TICKET_MESSAGES : sends
  TICKETS ||--o{ TICKET_NOTES : contains
  USERS ||--o{ TICKET_NOTES : admin_creates
  TICKETS ||--o{ TICKET_EVENTS : records
  USERS o|--o{ TICKET_EVENTS : actor
```

Seven application tables live in non-exposed `app`. Supabase owns `auth.users`; the migration adds a foreign key from `app.users.id` to that existing table but Prisma does not manage Auth tables. Auth deletion is restricted when business records exist.

| Table | Key choices |
|---|---|
| users | Auth UUID primary key, uppercase role enum with no default, normalized unique login email |
| author_profiles | Original author ID primary key, unique user UUID; exact contact values and DATE joined date |
| books | Original book ID primary key, author FK, exact source strings/platform array, Decimal money, nullable production data |
| tickets | Author FK, nullable book reference, original description, status/assignment, separate manual/AI fields, AI/cache metadata |
| ticket_messages | Public replies only; sender FK and per-sender/ticket retry key |
| ticket_notes | Private admin notes only; creator FK |
| ticket_events | Append-oriented event type, actor or system, constrained metadata usage |

Ticket categories map Prisma enum identifiers to the six exact assignment labels. Status, priority, roles, AI state/provider and audit types are PostgreSQL enums. Book status remains original source text, not the ticket-status enum.

All date-only values use DATE, application timestamps TIMESTAMPTZ(6), money Decimal(12,2). Transport will serialize money as strings and dates as YYYY-MM-DD. Source values are not recalculated or inferred.

## Constraints and indexes

- Composite `(book_id, author_id)` ticket FK references a matching book pair; null book means general account ticket.
- Source IDs and profile/user mappings unique. Login email normalized before insertion; lowercase checked in SQL.
- Unique author/ticket creation-request key and message sender/ticket/request key support replay-safe requests.
- Nonnegative book figures and nonblank bounded ticket/message/note text checked in SQL. Financial identities are not recomputed from incomplete data.
- Indexes support author lists, status/age queue, assignee/status, stable conversation/event cursors and effective AI/manual category/priority.
- Manual SQL includes `COALESCE(manual_*, ai_*)` indexes and a partial unseen-resolved-reply index. Do not create computed duplicate fields that could drift from manual precedence.

The migration adds Auth FK, checks, required array constraint, expression/partial indexes and privilege hardening beyond Prisma's schema language. Preserve these custom clauses when adding future migrations. Initial DDL is transactional. It has not been applied to hosted Supabase yet.

## Authentication and authorization model

Planned: shared email/password login; verified server identity through Supabase; `app.users.role` looked up by that UUID; redirect based on trusted role. No public signup or user-controlled role endpoint. Admins originate only in trusted bootstrap. An Auth user without an application user cannot access business data.

Authors query only their own profile/books/tickets. Sender/author identities come from the verified principal. Admins see all tickets and are the only users who change status, notes, classification and assignment. Assignee/creator role checks belong in services because ordinary foreign keys cannot validate another row's role.

Return explicit DTOs. Author payloads never include notes, internal events, cached drafts, raw provider errors or internal admin metadata. Nested resource queries include parent ownership, not only UUID lookup. Inaccessible objects return 404; administrative operations by authors return 403.

Browser publishable keys access Auth, not application tables. Migration revokes schema/table access from PUBLIC, anon and authenticated; keep app out of Data API exposed schemas. The reviewed runtime-role SQL grants read-only author/book/user access and only required ticket/conversation writes. It grants no DDL, role modification or audit updates. Runtime RBAC still must be enforced in the backend; Prisma does not automatically run as the Supabase user's RLS identity.

Future sessions use the Supabase SSR cookie adapter and refresh proxy. Mutation origin checks, no shared authenticated response caching, secure production cookies, input limits and text-safe rendering are required. M1 has only factory code; it does not provide an authenticated page.

## Planned data flows and consistency

Creation: verify author -> validate owned book -> transaction inserts ticket OPEN/event -> commit -> one bounded awaited classification call -> update AI fields/event. Provider failure keeps ticket accessible for manual triage.

Public reply: verify parent visibility -> serialize with status change on the ticket row -> reject CLOSED -> insert message/event atomically -> mark resolved-author reply attention without changing status. Duplicate request IDs replay rather than insert twice; conflicting replay bodies should return 409.

Admin changes: role check -> short transaction for changed fields/events. Assignment and messages never imply status changes. Acknowledgement compares the observed reply timestamp so it cannot hide a newer reply.

Draft: admin-only explicit POST -> context fingerprint/cache lookup -> conditional in-flight claim -> bounded provider request outside transaction -> cache save only if claim/context still match. Admin edits locally, then explicitly sends submitted text through the ordinary message endpoint. Polling does not regenerate drafts.

Use row-level serialization only for concrete mutation races. No general ticket version framework or attempt table. Timestamp claims deduplicate paid work and guard stale results; manual fields are never part of AI update payloads.

## Trade-offs and extensions

Polling (5 seconds detail / 15 seconds list while visible) avoids connection infrastructure. A short awaited AI call adds creation latency but avoids unreliable serverless background promises. A fixed versioned KB needs deterministic section selection, not vector search.

Hosted-only local development reduces setup cost but needs internet/service access. Keep environments separate and require explicit migration targets. Auth provisioning and Prisma seeding are separate recoverable operations, not one transaction.

Ticket links and private Cloudflare R2 attachments are deferred as independent tables. Their future access derives from existing ticket ownership and cannot expand it. See the revised plan for upload/download controls. No royalty accounting ledger, banking integration, stock-sync action, email notification system or operational escalation integration is planned for the core assignment.
