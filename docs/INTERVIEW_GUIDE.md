# Interview guide

## Current walkthrough boundary

Milestone 2 hosted setup, seed and author/admin logins were verified by the user. Milestone 3 adds author ticket creation, lists, conversations and polling. Admin lifecycle management and AI remain future work. See TESTING for independently executed checks versus user-reported results.

For ticket walkthroughs, start at src/server/validation/tickets.ts, then the thin /api/tickets handlers, services/tickets.ts and repositories/tickets.ts. Explain how the principal supplies author/sender IDs, strict schemas reject impersonation, the book composite foreign key backs up service ownership checks, and explicit DTOs omit notes, drafts and AI internals. The initial description is stored on the ticket; replies are separate public messages.

Creation request IDs are unique per author. Matching retries return the original resource; changed content returns 409. Concurrent unique-key collisions recover after rollback by reading the winner. Replies lock the ticket row, recheck ownership/status, deduplicate and atomically save message, timestamp and event. A replay of an already committed reply is readable even after closure; no new message is inserted. Future admin status changes must use the same row lock. RESOLVED author replies set an attention timestamp without changing status.

Polling uses authenticated REST every five seconds for conversation/detail and ten seconds for lists while the tab is active. It does not create server-side subscriptions or trigger paid AI calls. Pagination bounds response size; on long conversations newer replies may be on later pages. Manual category/priority override AI independently; neither set means awaiting triage.

## Explain the request flow

Browser form -> /api/auth/login -> strict Zod/origin checks -> auth service -> Supabase email/password sign-in -> getUser verification -> app.users lookup by UUID -> explicit principal DTO -> role-specific landing. JWTs/refresh tokens are set as HTTP-only cookies, never returned as JSON.

On later requests, proxy refreshes cookie sessions and forwards updated cookies into the request before pages render. Proxy is not the authorization boundary. Each protected page/API verifies Auth and reads the trusted application role. Server Components are cookie-read-only; writable Route Handlers and proxy persist changes. Logout clears all cookie chunks and revokes the current refresh session; already-issued JWT lifetime remains a limitation.

The browser Auth SDK was removed because it would need access to token storage. Server-only SSR clients plus REST maintain the required HTTP-only boundary. TanStack Query cache is cleared when accounts change or log out.

## Useful code walkthrough

1. package.json: setup targets, tests and offline generation/build.
2. src/server/config: URL/project/role checks; runtime configuration is separate from privileged setup credentials.
3. src/server/auth: cookie policy, Supabase gateway, principal resolution and pure role/ownership policies.
4. src/proxy.ts: refresh only, no role inferred from cookies.
5. src/server/services and repositories: orchestration vs scoped DB query. Book detail uses an ownership predicate rather than loading then relying on a frontend check.
6. scripts/lib/provisioning.ts: desired identities, server marker, preflight and recoverable Auth-then-DB steps.
7. scripts/lib/adapters.ts: actual Admin API and serializable Prisma mapping writes.
8. scripts/lib/seed.ts and verify.ts: idempotent source import and exact round-trip checks.
9. prisma schema/migration: UUID vs source keys, Decimal/DATE, composite ownership FK, private/public separation.
10. tests and documentation: distinguish deterministic tests from opt-in live HTTP verification.

## Auth UUID versus original author ID

Supabase UUID is a security identity. AUTH001 is a supplied business identifier. app.users.id equals the Auth UUID and is referenced by the author profile's unique user_id. author_profiles.author_id preserves AUTH001, and books reference that original ID. Admins are users without profiles. The DB Auth foreign key binds these identities without Prisma managing Supabase's auth schema.

Auth metadata is never a runtime role source. A user cannot set ADMIN through sign-in JSON, editable metadata or frontend navigation. A valid Auth identity without a complete application row is denied. Both configured admins receive the same ADMIN guards; bootstrap never promotes an author.

## Why these demo credentials?

The user explicitly approved exact email.com source logins, two admin identities and environment-owned shared initial passwords for the isolated assignment. This supersedes the safer alias proposal. These are deliverable domains, so confirmation toggles alone are insufficient. Setup requires explicit project approval, signup disabled and a non-sending Send Email hook with separately verified activation.

In production use real identity ownership verification, individual private credentials, appropriate recovery/MFA, least-privilege operational access, abuse controls and audited account lifecycle. Public shared demo passwords are not a production authentication policy.

## Idempotent provisioning and failure recovery

Before writing, validate source bytes, target/project, migration checksums, email controls, restricted runtime permissions and current Auth/app inventory. Existing email alone proves nothing: require the exact server-controlled bookleaf_demo marker and compatible UUID, source ID, role and profile mapping.

If Auth creation succeeds but DB mapping fails, rerun finds the marked account and completes the mapping. Auth and Prisma cannot share a transaction. New user/profile writes are serializable; ordinary reruns update source/display values only after identity checks, never passwords/roles/UUID ownership. A lost Auth response is reconciled on rerun. Unexpected accounts or changed owners stop setup without deleting them.

Books upsert by original ID after validating author mappings. The import never deletes ticket data. Verification checks 12 Auth/app users, 10 profiles, 2 admins without profiles, all 18 books and every original field, including platform array order. Mocks validate orchestration; real constraints need live integration tests.

## Ownership and database choices

Authors get authorId only from the trusted principal. List/detail repositories include that scope. Admin filters are guarded; invisible book detail returns 404. Current ticket APIs do not exist, so ticket isolation is an upcoming test obligation.

The app schema is not exposed through Supabase Data API. Runtime DB role cannot change users/roles, import source data, perform DDL or rewrite events. Prisma connects as this service role, not the individual Supabase Auth user's RLS identity; backend policy remains essential.

Decimal avoids persisted binary floating-point money. DATE preserves calendar dates without timezone shifts; TIMESTAMPTZ records instants. Source placeholder ISBNs must not be rejected by genuine ISBN validation. Production nulls must not become zeros/dates. Aggregate royalties cannot establish bank linkage, payout eligibility or per-platform accounting.

## Upcoming ticket and AI discussion

Future ticket services retain OPEN creation, explicit admin status changes, no status effects from messages/assignment, resolved replies without reopening, closed reply rejection and private notes separate from messages. Short row serialization protects close/reply races; unique request keys protect retry duplication. No global version framework or queue.

AI classification follows persistence and uses bounded structured output; manual fields always win. Drafts use a persisted context fingerprint/cache and explicit review/send. A draft never performs an escalation, payment or stock re-sync. Only verified facts and relevant KB policies can support such language. Shape validation does not prove factual truth; human review reduces but does not eliminate risk. Mock provenance must be visible.

## Tests and trade-offs to defend

Current deterministic suites cover role denial, missing mappings, origin/validation errors, HTTP handler contracts, book scoping, seed preservation, identity conflicts, two-admin parity and provisioning restart/idempotency. test:hosted uses a real running app and hosted services, inspects HTTP-only cookies and all twelve configured logins, but must not be called a passing integration result until executed.

Hosted-only development reduces reviewer prerequisites but requires service/network access. Polling and fixed KB section selection avoid infrastructure cost. Later R2 attachments use private storage and reauthorized signed access. Ticket links never expand access. The four-day plan prioritizes required ticket flow and reliable AI over optional uploads/polish.
