# Consolidated implementation plan

Status: Milestones 2 and 3 reviewed by the user. Milestone 4 implements admin queue/filtering, self-assignment, manual triage, explicit status changes/reopening, private notes, history and resolved-reply attention. See TESTING for executed checks and hosted limitations. Stop for Milestone 4 review before AI. The pasted Milestone 2 instructions supersede previous identity/password choices.

## Delivery and acceptance

The assignment requires source code, a working live demo with author/admin access, API/setup documentation and a write-up of at most one rendered page. Evaluation: AI quality 25%, architecture/code 25%, API 15%, functionality 15%, product thinking 10%, documentation 10%.

Core acceptance: author isolation, exact book records including production/null cases, ticket creation and conversation, admin queue/filtering/assignment/notes/status management, near-real-time updates, AI classification with manual precedence, grounded editable drafts, graceful AI failure and secure keys.

## Final architecture

- Next.js App Router/React/TypeScript, Tailwind/shadcn UI; Node Route Handlers at actual `/api/...` paths.
- One modular monolith: UI -> HTTP -> verified principal/validation -> services -> repositories/Prisma. Separate AI providers.
- Hosted Supabase Auth and PostgreSQL only. Local Next.js connects to the hosted development project. Prefer a different project for deployed demo. No Docker/local DB setup requirement.
- Prisma schema/migrations and future idempotent seed; Zod validation; TanStack Query polling; OpenAI real and deterministic mock providers in later milestones.
- No Express, queue, Redis, WebSockets, vector database or orchestration framework.

## Milestones and gates

| Milestone | Work | Acceptance gate |
|---|---|---|
| 1: foundation | Scaffold/dependencies, boundaries, environment handling, seven-table schema/initial migration, Supabase/DB factories, initial documentation | Types, lint, unit data/config tests and production build; accurately disclose hosted verification gaps |
| 2: identity and exact data | Login/logout/session refresh; trusted identity/application role; author provisioning and admin bootstrap; exact seed and ownership verification | Two authors isolated; Auth UUID mapping correct; ten profiles/eighteen books; repeated setup safe and password-preserving |
| 3: author/ticket core | Own books, ticket creation/general book option, public conversation, API contracts, idempotency | Core flows work without AI; cross-author access/book references rejected; duplicate submissions safe |
| 4: admin/lifecycle | Queue/filter/sort, self-assignment, explicit status transitions, private notes/events, attention indicator and polling | Closed replies rejected atomically; resolved replies do not reopen; private data never appears in author DTOs |
| 5: AI | Structured classification; bounded awaited attempt after ticket persistence; retry/manual triage; cached grounded editable drafts | AI failure never loses tickets; overrides survive AI writes; no automatic send or repeated paid generation |
| 6: delivery | Focused HTTP/E2E checks, hosted setup verification, deploy isolated demo, documentation and one-page write-up render check | Required acceptance scenarios verified; live demo author/admin access works; gaps disclosed |
| Later: attachments | Cloudflare R2 only after core completion/tests | Approved optional scope; secure storage and access tests |

Four-day prioritization: day 1 foundations and identity/data; day 2 author/ticket/admin core; day 3 AI and lifecycle hardening; day 4 testing, deployment, write-up and polish. Review gates govern progress even if the calendar requires adjustment. Milestone 1 ends before full auth, provisioning, ticket routes, portals or AI implementation.

## Unchanged ticket rules

- New tickets OPEN. Assignment/messages never change status. Only admins set status; IN_PROGRESS is explicit.
- RESOLVED accepts replies without reopening. New author replies are highlighted to admins.
- CLOSED is readable but rejects public messages from both roles. Admins explicitly reopen resolved/closed tickets.
- Public messages and internal notes have separate tables. Meaningful mutations generate audit events in the same transaction.
- Manual category/priority each override their AI counterpart. Neither present means awaiting triage. AI writes never touch manual values.

## Concurrency defaults

Use unique request IDs for ticket/message retries. For close-versus-reply, briefly lock the ticket within the same transaction as the reply/status operation. Only those conflicting mutations need serialization. No generic ticket version framework.

For each AI task, use a persisted started timestamp and a short conditional claim/expiry to deduplicate work and reject stale completions. No attempt table/UUID orchestration. Keep OpenAI calls outside transactions. Draft reuse keys on a context fingerprint; explicit regeneration bypasses the cached text but respects the in-flight claim.

## Identity and seed policy

Use the exact ten source email.com Auth logins, explicitly approved by the user for this isolated demo. No aliases. Two admins use DEMO_ADMIN1_EMAIL / DEMO_ADMIN2_EMAIL, separate from author profiles. Environment-owned demo defaults are Bookleaf123 and admin1@email.com / admin2@email.com. These disposable credentials must never be reused with real data. The obsolete singular admin-email variable is removed.

Setup requires matching target/project approval, applied migrations, disabled signup, restricted runtime permissions, the reviewed no-mail function and separate confirmation that Send Email hook activation was verified. Keep DEMO_EMAIL_DISABLED_CONFIRMED=false and do not provision until both safety checks are complete. Existing identities require exact trusted markers and compatible DB mappings. Stop on conflicts; never reset passwords, promote roles, reassign UUIDs or delete accounts as compensation. Recovery spans Auth calls and Prisma transactions.

## Source ambiguities and explicit defaults

- Attachments: PDF explicitly says UI-only and actual upload is a bonus. Disabled honest placeholder is compliant; future provider is R2, never Supabase Storage.
- Source contains 16 published titles and two in production; show all owned books, preserving nulls and empty platform arrays.
- ISBNs are placeholders containing X; preserve them without checksum validation.
- Monetary values are financial snapshots, displayed as INR in context; no accounting ledger, banking screen or per-platform sales invented.
- KB examples request confirmed escalations/re-syncs and payout timelines unavailable in the data. Approved behavior: ground drafts in actual facts and describe proposed next steps/policy windows; never invent completion or case-specific promises.
- Collaborator email remains unspecified in the assignment; obtain it at submission time.
- Test setup commands against hosted Supabase before claiming that workflow works. Real/mock modes are future implementations, not completed features.

## Deferred schema extensions

`ticket_links`: canonical unordered pair of ticket UUIDs, creator/timestamp, no self-links, unique pair. Bidirectional; no types, status/priority changes or access grants. Authors manage links only where both tickets are theirs; admins manage existing links.

`ticket_attachments`: ticket/message association, uploader, opaque R2 object key, original display filename, verified content type/size, lifecycle state and timestamps. Author/admin access derives from the parent ticket. Attachment relationships for private notes must remain private; initial extension should cover public ticket/message files only. No table or R2 integration in Milestone 1.

Future uploads: server verifies access, closed-ticket policy and size/type allowlist; issues short-lived presigned URLs to a private R2 bucket under random object keys; finalization verifies object metadata before exposing it. Downloads reauthorize against the ticket and issue short-lived signed GETs; no public bucket URLs. Sanitize filenames, force safe download headers, use narrow CORS, keep R2 secrets server-only, and clean up abandoned uploads. Scan/verify content before availability; do not trust extension or client-supplied MIME alone.
