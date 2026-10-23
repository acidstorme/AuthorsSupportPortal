# Testing and verification

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

- Hosted migration/SQL execution, runtime-role permissions, active email hook and CA-backed DB connectivity.
- Real Auth creation, idempotency/recovery and exact DB round trips.
- Actual authenticated login/session refresh/logout and ownership behavior; real expiry/refresh timing is not proven by the mocked proxy test.
- Full browser Playwright UI flows; current real-HTTP smoke/harness does not replace browser interaction coverage.
- Ticket APIs/lifecycle, private-note isolation, AI behavior and polling are deferred, not implemented/tested.
- Live demo/deployment and Node 24 compatibility.
- Final write-up render check; its short draft will be rendered at delivery.

## Historical Milestone 1 and dependency audit

M1 passed 14 tests, clean lockfile installation with npm 11.21.1, types/lint/schema/build and credential-free scaffold smoke checks. npm 11.5.2 initially crashed in peer resolution.

M1 online audit reported five high findings in a development-only braces -> micromatch -> fast-glob -> Next ESLint chain; latest braces then was 3.0.3 with no patched release. The suggested forced fix downgraded the Next ESLint config across major versions and was not applied. Production audit reported zero vulnerabilities. M2 adds no dependency changes; this is a historical audit result, not a fresh clean full-audit claim.

Source checksum remains 34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8; Git marks the JSON -text to preserve its bytes.
