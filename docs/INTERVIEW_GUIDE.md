# Interview guide

## Current demonstration boundary

Milestone 1 is a foundation, not a finished portal. You can demonstrate the scaffold, schema/migration, environment guards, source validation and unit tests. Login, provisioning, ticket flows and AI are **planned**. Do not claim to have demonstrated them until later milestones pass their tests.

## Opening explanation

“BookLeaf needs a support portal where authors see only their own information and operations staff can manage tickets. I chose a single Next.js application with a REST boundary and separate business modules. Supabase supplies identity and PostgreSQL; Prisma manages application data. AI will assist triage and draft replies, while admins remain responsible for final decisions and sending.”

Explain why the four-day constraint favors simple infrastructure and explicit correctness: one application deployment, polling, a small fixed KB and bounded awaited calls. The architecture remains modular even without separate services.

## Suggested code walkthrough

1. `package.json`: supported runtime, lockfile, generation before types/build, explicit checks and migration wrappers.
2. `src/app`: minimal page and provider wiring. Root runtime is Node. There is deliberately no fake portal/login.
3. `src/server/config`: lazy runtime validation, shared `.env` loading for scripts, target/project guards. `src/shared/config` contains only browser-safe public configuration.
4. `prisma/schema.prisma`: users/profile split, exact book fields, lifecycle enums, nullable general-ticket book reference, public/private separation, audit model and cache fields.
5. Initial migration: generated DDL plus manually reviewed Auth FK, checks, indexes and schema permissions. Explain why those custom clauses must survive future changes.
6. Supabase factories and lazy Prisma adapter: server-only integration boundaries, no credentials accessed by the public scaffold.
7. Dataset copy/checksum and tests: proof of preserving the exact input, including placeholder ISBNs and in-production nulls.
8. Documentation: point out verification gaps and the next milestone instead of presenting planned features as finished.

## Database questions to prepare for

**Why users and author_profiles?** Both roles authenticate as users. Author business identity retains AUTH001-style IDs independently of the Auth UUID. Admins need no author profile. A unique profile user ID makes the relationship one-to-one.

**How do you bind Auth to application data?** Supabase creates the Auth UUID; the app uses that same UUID as users PK. SQL references Supabase-owned auth.users. Future provisioning can recover if Auth succeeds but the Prisma transaction fails; the two systems are not assumed transactional together.

**Why synthetic logins?** Source contacts use email.com, which could be real. Auth aliases under `.example` avoid contacting or claiming those identities; original contacts stay exact in profiles. New accounts share one configured demo author password, separate from admin, with no ordinary password resets.

**How is cross-author book assignment prevented?** Service validates the selected book against the trusted author identity, then the composite `(book_id, author_id)` FK supplies a second safeguard. A null book remains valid for account-level queries.

**Why Decimal and DATE?** Currency arithmetic must not use binary floating point in persisted business values. A publication date is a calendar date and should not shift through timezones. Application events need absolute timestamps, so they use TIMESTAMPTZ. The supplied financial snapshots are not sufficient to build a complete accounting system.

**Why are ISBNs not validated as genuine ISBNs?** The supplied strings intentionally contain placeholder X characters. Strict ISBN validation would reject the authoritative dataset.

**What is indexed?** Author-owned lists, status/age and assignment queues, stable time/ID conversation cursors, effective classification expressions and unseen resolved replies. More indexes are justified by measured queries, not speculation.

## Security explanation

The future backend verifies Supabase identity, then loads the application role. Cookie contents, client metadata, request author IDs and frontend redirects cannot authorize access. Authors get scoped queries and explicit DTOs; admins have broader ticket access. Notes/drafts/internal audit data cannot enter author DTOs.

The database schema is not exposed through Supabase's Data API. An Auth publishable key is not a database password. The runtime DB role has no role-changing/DDL/import privileges; trusted provisioning and migration credentials stay outside the web runtime. Prisma's service connection does not automatically implement Supabase per-user RLS.

Session refresh, origin checks, secure production cookies and protected routes arrive with auth implementation. The M1 client factory alone does not implement authentication or authorization. Closed-ticket rules and sender integrity must be enforced server-side even if the UI disables a control.

## Concurrency examples to defend

- An admin closes a ticket while an author replies: both operations serialize briefly on the ticket row, so a reply cannot slip in after close. No long transaction spans an AI call.
- A client retries after losing a response: a unique request key returns the original record; changed payload for the same key is a conflict.
- An admin overrides HIGH while AI returns LOW: separate fields and narrow AI writes preserve the override.
- React Strict Mode or two admins request a draft: persisted cache/fingerprint plus a conditional in-flight timestamp claim avoids repeated paid work.
- An admin acknowledges a resolved-ticket reply while a newer reply arrives: acknowledgement uses the observed timestamp, preserving new attention.

These are planned transaction-service behaviors, not features validated by the M1 schema alone. No global versioning framework or extra attempt-management table is needed.

## AI explanation for later milestones

Two independent capabilities: structured triage and grounded draft assistance. Persist the ticket first; bounded classification failure leaves manual triage. A cached draft is internal text, never a message until an admin explicitly submits final edited content.

Use only scoped ticket/book facts and relevant KB sections. The model cannot know bank linkage, payment completion, stock re-sync, escalation completion or actual production delay causes from this dataset. Describe policies and proposed next steps without inventing those facts. Shape validation is not factual validation; malicious ticket text is untrusted input, not a new system instruction.

Explain output/context budgets, model choice, timeout/rate-limit/refusal handling, cache reuse, mock provenance and opt-in live evaluation. A fixed small KB does not justify vector retrieval. Manual review is necessary but does not eliminate hallucinations.

## Testing and trade-offs

M1 tests validate configuration safeguards and exact data. Later layers must test real PostgreSQL constraints/transactions, HTTP cookies/roles, and two-session polling with Playwright. Mock AI makes CI deterministic; live AI quality needs a separately recorded evaluation.

Hosted-only setup simplifies reviewer prerequisites but relies on internet and service access. Short awaited classification is reliable within a bounded serverless request but adds latency. Polling is adequate here but may need reconsideration at larger concurrent-user volume. Deferred attachments will use private R2 storage with server-authorized signed operations; links cannot expand ticket access.

## Honest limitations to mention

- No external services, migration application, accounts or deployment verified yet.
- Five high development-only transitive audit findings remain; production audit is clean.
- Node 24 is allowed but has not been tested in this environment.
- A live demo and final one-page rendered write-up are future delivery checks.
- You should be able to explain every implemented line and distinguish it from target architecture.
