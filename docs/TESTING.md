# Testing and verification

## Draft preview UX follow-up — 24 October 2026

- Lint, TypeScript and production build passed for the updated composer.
- `npm run test:ai:composer -- development`: PASS using installed system Edge in headless mode, against a temporary localhost:3107 production server.
- Browser scenarios: initial/empty/whitespace-only autofill; autofill after sending; non-empty editor preserved; one-line preview; View/read-only full-text modal; explicit Use generated text replacement; Escape dismissal; typing and clearing while a draft request is in flight.
- The browser test uses the existing configured admin for real login/SSR but intercepts all ticket/draft/message APIs with synthetic fixtures. It performs no model calls, ticket writes, account provisioning or email operations. This verifies actual editor/modal interaction, not live AI quality or the entire portal's browser behavior.
- Repeat with a local app at APP_URL, CA trust exported before startup, and system Edge installed: `npm run test:ai:composer -- development`. Chromium remains undownloaded; Edge is used through Playwright's msedge channel. Prior Milestone 5 statements about missing browser coverage are historical; this focused interaction now has browser coverage.

## Milestone 5 verification — 24 October 2026

Milestone 4 was verified/reviewed by the user. The supplied certs/prod-ca-2021.crt, exported through NODE_EXTRA_CA_CERTS **before Node startup**, resolved agent certificate trust. No migration, grant, Auth provisioning, password reset or source-data modification was needed.

| Check | Executed result |
|---|---|
| npm run check | PASS: lint, generated/TypeScript validation, 132 tests in 24 suites, Prisma schema validation and production build |
| npm run setup:safety with supplied CA | PASS: restricted runtime identity, no user UPDATE, no elevated role flags, reviewed no-mail function/rejection and disabled signup; dashboard activation remains user-confirmed |
| npm run test:smoke -- http://localhost:3105 | PASS: 35 actual anonymous HTTP checks, including admin-only AI POST denial and GET 405 |
| npm run test:ai:hosted -- development | PASS after timestamp fix: real hosted Auth/DB, MOCK classification, saved cache, cooldown, stale context/manual precedence, no auto-send and reviewed reply visible to author |
| npm run test:admin:hosted -- development | PASS with AI enabled: both admins, actual queue filters, assignment/manual triage, private notes/retries, RESOLVED attention, close/reply race, CLOSED rejection, reopening and audit history |
| npm run test:ai:hosted -- development failure | PASS against a separate app with AI_MODE=openai / OPENAI_API_KEY=replace-me: login, saved ticket, FAILED classification, sanitized draft failure and successful manual public reply |
| npm run test:ai:live -- live | PASS: two authorized synthetic paid requests using configured gpt-4o-mini (resolved gpt-4o-mini-2024-07-18), ISBN_METADATA_ISSUES/HIGH and grounded draft; no author records submitted |
| Chromium executable probe | Not installed; browser-driven editor/polling tests remain unverified |

The first hosted AI cache test found a generation timestamp mismatch between the initial response and persisted/cache response. Fixed by passing one completion timestamp through persistence/serialization; a regression assertion was added and the hosted rerun passed. Earlier local attempts also exposed a stale session-refresh mock after separating core/AI environment validation and a test ProcessEnv annotation; both were corrected before the complete passing check.

Real provider usage: classification 221 input/14 output tokens; draft 636 input/151 output. Synthetic draft was manually inspected: it requested correct ISBN/listing evidence, proposed review/escalation and made no false completed-action or resolution-date claim. This is a connectivity/schema/grounding smoke, not an accuracy score or broad adversarial eval. See AI_DESIGN for dated pricing estimate and limitations. No raw provider errors, keys, tokens or author prompts were logged.

Retained records: the initial failed cache test left one labelled Milestone 5 ticket/cached draft with no sent reply; the passing rerun retained ticket 2b970dac-6d5d-4278-bc22-104f67322e74 and one reviewed reply; admin regression retained 6732f122-eecb-4a74-b6d8-7f1bacd02d60 plus private note/replies/history; deliberate AI failure retained d21fb4c2-3605-4d18-9242-111612819f32 and one manual reply. These are synthetic fixtures in the approved development project; none were deleted or used to reset source records. Temporary servers used ports 3105/3106 and are stopped after verification. Shell-only overrides did not modify .env.local.

The temporary mock server emitted a pg deprecation warning about queuing a query while its client is already executing one (removal planned for pg 9). The concurrent HTTP tests still passed on the installed pg version; no driver upgrade or warning suppression was made. Review this before a future major driver upgrade.

Tests added: all six categories/four priorities; selected/multi-topic KB; below-threshold/unknown financial data and production nulls; prompt-injection instructions treated as data; mocked real SDK strict schema, refusal/incomplete/timeout handling, output bounds and no tools/storage; core Auth/DB safety despite invalid optional AI; current-claim-only AI writes without manual columns; guarded draft claims/cache preservation; fingerprint changes; context changes during generation; admin-only POST guards; persistence-before-AI and replay without another call. These deterministic checks do not prove semantic safety for arbitrary real model output.

To repeat the optional failure scenario, start a **separate shell/app process** with APP_URL matching an unused port, AI_MODE=openai and OPENAI_API_KEY=replace-me. In a test shell use that same APP_URL, AI_MODE=mock for preflight, export the CA, and run `npm run test:ai:hosted -- development failure`. Do not change your saved credentials to create this fixture. The normal hosted AI test requires mock mode in both processes. The live test requires an explicit final `live` argument and makes two paid synthetic requests without DB/Auth operations.

## Milestone 4 verification — 24 October 2026

Milestones 2 and 3 were reviewed by the user. No migration, seed, runtime grant, credential or Auth configuration change was made for this milestone.

| Check | Executed result |
|---|---|
| npm run check | PASS: lint, generated types/TypeScript, 99 tests in 18 suites, Prisma validation, production build |
| Initial check | STOPPED by readonly Prisma JSON metadata type error; fixed with a mutable typed record; later complete checks passed |
| Temporary production server | Started on localhost:3104; stopped after verification |
| npm run test:smoke -- http://localhost:3104 | PASS: 31 actual anonymous HTTP checks, including admin APIs, notes/events, mutations and admin detail redirect |
| npm run test:admin:hosted -- development | STOPPED at migration verification, before sign-in or fixture creation |
| npm run setup:safety | BLOCKED: self-signed certificate in certificate chain; no verification bypass |
| git diff --check | PASS |

New deterministic tests cover ADMIN restrictions across every endpoint; equal access for both admins; trusted self-assignment and clearing; strict body/query/UUID validation; all sixteen explicit status pairs including reopening/no-op; manual values/clearing without AI writes; private note DTOs and retry conflicts; parameterized queue filters/enum labels/priority ordering/pagination; row-lock ordering; resolved-reply attention and stale acknowledgement. Existing public DTO/isolation and CLOSED/RESOLVED reply tests remain passing. Prisma is mocked at repository boundaries: these tests do not prove real PostgreSQL close/reply serialization.

Opt-in hosted command: `npm run test:admin:hosted -- development` with the app running at APP_URL and CA trust configured in both server and test processes. It first checks approved environment/project, signup, migrations, no-mail function and runtime role. It then signs in an author/two admins and retains one labelled test ticket, private note, public replies and audit events. It exercises queue filters, manual classification, assignment, note retry/visibility, RESOLVED reply/attention, close/reply race, post-close denial, reopening and history. Either valid race order is accepted; new replies after closure must always be rejected. No account creation, mail, password resets, deletes or direct privileged ticket mutations are performed.

Manual review still required: use separate author/admin browser sessions to verify queue/detail rendering, notes privacy, five/ten-second active-tab polling, resolved attention, explicit status transitions and reopening. Browser-driven E2E and successful hosted lifecycle/concurrency checks are not claimed from this agent environment. The user's reviewed prior setup remains acknowledged.

## Milestone 3 verification

The user reports Milestone 2 hosted setup, seed, safety checks and author/admin sign-ins all passed and approved progression. This is distinct from checks executed by the agent below.

- `npm run check`: PASS (lint, TypeScript/route generation, 79 tests in 15 suites, Prisma validation, production build).
- Ticket service/HTTP tests: owner scope, author-only creation/list, general/owned books, foreign book rejection, strict sender/role injection rejection, 401/403/404, validation/pagination/filter contracts, explicit DTOs, manual precedence, retry conflicts and concurrent creation winner recovery.
- Reply repository tests use a mocked transaction: lock before status check, CLOSED rejection for either role, RESOLVED attention timestamp without reopening, committed retries and no duplicate events. These do not prove real PostgreSQL concurrency.
- Production server started at localhost:3103. Initial npm port forwarding failed; direct Next CLI start succeeded.
- `npm run test:smoke -- http://localhost:3103`: PASS, 21 anonymous actual-HTTP checks including ticket routes and protected author pages.
- Hosted ticket test attempted twice: STOPPED at migration verification before ticket writes. Read-only `setup:safety` independently reports SELF_SIGNED_CERT_IN_CHAIN. The agent process does not have working certificate trust for these connections; the user's successful verification is not disputed. No test tickets or replies were created by these attempts. No TLS verification was disabled.
- Browser-driven author creation/polling and actual PostgreSQL concurrent ticket writes remain unverified in this environment. Admin UI/lifecycle, AI and private-note API tests belong to later milestones; public DTO isolation is covered now.

Opt-in command after the app starts: `npm run test:tickets:hosted -- development`. It checks approved project, signup, migrations, reviewed no-mail hook and restricted runtime before creating two labelled tickets/two replies. Concurrent HTTP requests exercise duplicate safety, author isolation, book checks, pagination and audit counts. Successful runs retain these records for review. It never provisions users or changes passwords/statuses. Configure CA trust in both server and test shells (for example NODE_EXTRA_CA_CERTS before Node starts); do not bypass verified TLS.

## Milestone 2 results — 23 October 2026

Environment: Windows, Node 22.17.0, Next.js 16.4.2, Prisma 7.10.1, TypeScript 5.9.3. No dependency changes were required.

| Check | Actual result |
|---|---|
| npm run check | PASS: lint, generated Prisma/Next types, TypeScript, unit tests, schema validation and production build |
| Unit/handler suites within check | PASS: 59 tests in 12 suites, including migration bootstrap and checksum regressions; mocked/in-memory integration boundaries |
| npm run data:validate | PASS: 10 source authors, 18 books, exact original SHA-256 |
| Production server on localhost:3102 | Started successfully |
| npm run test:smoke -- http://localhost:3102 | PASS: 15 anonymous actual-HTTP checks; no hosted calls or account/session creation |
| npm run env:check:demo -- development | EXPECTED STOP: runtime connection lacks required parameters/restricted user |
| npm run env:check -- development after bootstrap fix | EXPECTED STOP: current DIRECT_URL lacks required URL configuration; no runtime dependency or network call |
| npm run setup:safety | BLOCKED: strict TLS reports an untrusted/self-signed certificate chain; role/function existence not established |
| Hosted provisioning/bootstrap/seed | NOT RUN: user requires email safety and runtime-role checks first |
| npm run test:hosted -- development | NOT RUN: safety/configuration prerequisites incomplete |
| git diff --check | PASS: no whitespace errors |
| .env.local ignore check | PASS: ignored; credentials not committed |

Next.js/Vitest/local networking were initially blocked by this Windows automation sandbox (path canonicalization, temporary-file rename or localhost EACCES). Approved execution outside the sandbox passed. These failed attempts are not passing results. The TLS error from the hosted diagnostic persisted outside the sandbox; certificate verification was not disabled.

No real sign-in, account count, hosted seed idempotency or authenticated ownership success is claimed from mocked tests. The currently false email acknowledgement is respected. No account provisioning or email-triggering endpoint was run.

The user's SQL Editor report confirms the selected project lacks the app schema. Initial migration must precede runtime-role and email-hook SQL. The helper SQL files now provide explicit prerequisite errors and transactional execution; hosted execution remains unverified.

## Local commands

Bootstrap regression coverage separates migration-only configuration from runtime/provisioning configuration. CLI fixtures omit DATABASE_URL, Auth settings and AI keys; the mocked Prisma executor verifies deploy/status invocation without database writes. Wrong targets/projects, invalid TLS/schema/credentials, and owner credentials in runtime/provisioning remain rejected. Hosted migration execution is not covered by these mocks.

```bash
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run data:validate
npm run build
```

Aggregate: `npm run check`. Unit watch: `npm run test:watch`.

With the app running at its configured APP_URL:
```bash
npm run test:smoke
```
An optional localhost URL argument supports a separate test port, but the server's APP_URL must match it for origin checks. The smoke script tests public/login pages, anonymous API 401, role-page redirects, pre-auth validation, cross-origin rejection, idempotent anonymous logout, missing signup and deferred ticket endpoints. It does not log in or contact hosted services.

## What local tests actually cover

- Runtime/project/TLS/role configuration, explicit targets, demo-project approval, missing/foreign service keys, duplicate admin identities and false email acknowledgement.
- Native ESM CLI environment loading, target denial before DB invocation, no credential echo.
- Exact source bytes and all fields, production nulls, duplicate/unknown data rejection.
- Trusted UUID-to-role/profile resolution, missing app user denial, stale email and inconsistent profile rejection, equal admin authorization, author/admin guards.
- Ownership passed into book queries; author filters denied; invisible books 404; Decimal/date/null-safe DTOs.
- Login verification and generic failure, no token response, cleanup for unprovisioned identity, refresh-session logout and local cleanup on provider failure.
- Mocked refresh proxy writes HTTP-only/Secure/SameSite cookies, forwards fresh chunks into the current request, preserves chunk deletions, skips refresh for auth mutations/no cookies.
- Handler status/error contract, strict JSON, role-field spoofing, same-origin guard and no-store admin responses.
- In-memory provisioning: exactly ten source-email authors/two admins, no admin profiles, no duplicate creations/password changes on rerun, recovery after Auth succeeds but DB fails, unmarked/foreign markers and UUID/role/profile/book conflicts rejected.
- In-memory seed: eighteen books on repeated import, exact source verification and wrong-owner rejection. No transaction/constraint integration claim is inferred from this adapter.

The test-only server-only alias permits importing server modules in Vitest; production retains the real import barrier.

## Hosted verification procedure — pending

1. Configure the isolated project, trusted direct/session DB connection, restricted runtime role and CA trust.
2. Install scripts/sql/block-auth-emails.sql and activate app.block_demo_auth_email as the Send Email hook in the dashboard.
3. Keep DEMO_EMAIL_DISABLED_CONFIRMED=false until function permissions and dashboard activation are verified. Run setup:safety for read-only diagnostics.
4. With both safety checks complete, explicitly approve that project in configuration and run guarded provisioning/bootstrap/import.
5. Run setup:verify. It checks exactly 12 Auth/app accounts, 10 profiles, 2 ADMIN users without profiles, 18 correctly owned books, every source field and trusted identity markers.
6. Repeat author/admin provisioning and source import. Counts must remain unchanged; existing passwords must not reset.
7. Start Next.js locally, then run:
```bash
npm run test:hosted -- development
```

The hosted harness uses Playwright's API request client, not downloaded browsers. It performs real HTTP sign-ins for all twelve configured identities, checks each role/landing and book mapping, both admins' access, author admin-API/page denial, cross-author book denial, cookie attributes, anonymous denial, origin checks and logout. It creates only sessions. It must never be relabeled as a passing integration result until executed.

Do not create conflicting disposable users in the real demo merely to exercise negative cases; deterministic tests cover these conflicts. Use a separate explicitly approved test project for future destructive fixtures. No Docker/local database is required or introduced.

## Remaining gaps

- Full account provisioning/recovery rerun was user-verified in Milestone 2, not repeated destructively during AI work. No account password reset or role reassignment is claimed/tested.
- Real expiry/refresh timing is not proven by mocked proxy tests or short HTTP sessions.
- Full browser Playwright UI flows; current real-HTTP smoke/harness does not replace browser interaction coverage.
- Broad real-model accuracy/adversarial evaluation, long-conversation quality and account-level AI budget enforcement; current live check is one synthetic ISBN case.
- Browser-observed polling/edit preservation; HTTP service tests do not replace UI interaction coverage.
- Assignment-required queue date range and oldest-unresolved visibility need delivery follow-up; newest/updated/priority controls alone do not satisfy these fully.
- Live demo/deployment and Node 24 compatibility.
- Final write-up render check; its short draft will be rendered at delivery.

## Historical Milestone 1 and dependency audit

M1 passed 14 tests, clean lockfile installation with npm 11.21.1, types/lint/schema/build and credential-free scaffold smoke checks. npm 11.5.2 initially crashed in peer resolution.

M1 online audit reported five high findings in a development-only braces -> micromatch -> fast-glob -> Next ESLint chain; latest braces then was 3.0.3 with no patched release. The suggested forced fix downgraded the Next ESLint config across major versions and was not applied. Production audit reported zero vulnerabilities. M2 adds no dependency changes; this is a historical audit result, not a fresh clean full-audit claim.

Source checksum remains 34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8; Git marks the JSON -text to preserve its bytes.
