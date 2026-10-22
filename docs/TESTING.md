# Testing and verification

## Current test layers

Milestone 1 has **14 tests in three unit suites** across environment configuration, standalone CLI guards and supplied-data integrity. No business services, HTTP routes, integration suites or Playwright flows are implemented. Playwright is installed but browser binaries have not been installed by this project.

```bash
npm run lint
npm run typecheck
npm test
npm run data:validate
npm run db:validate
npm run build
```

`npm run check` combines lint, types, unit tests, schema validation and build. Source-data validation is a separate explicit command. All current checks can run without service credentials. The public scaffold never calls the integration factories.

## Unit scenarios

- Mock configuration needs no OpenAI key; explicit real mode does.
- Auth/runtime DB project mismatches fail; migration DB mismatches fail.
- Migration requires an explicit environment target and rejects transaction-pooler connections.
- Runtime configuration requires the app schema and TLS verification; demo origin requires HTTPS.
- Malformed URLs produce structured validation errors rather than crashing the validator.
- Standalone ESM scripts load configuration successfully; wrong-target migration stops before invoking Prisma and logs no fixture password.
- Exact source SHA-256 matches, Zod parsing preserves all fields, in-production nulls/platform arrays remain intact, duplicate IDs and unknown fields fail.

The dataset checksum is `34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8`. Git marks the JSON `-text` to prevent newline normalization from changing its bytes across platforms.

## Verification record — 22 October 2026

Environment: Windows, Node 22.17.0. Initial install with npm 11.5.2 hit a resolver `edgesOut` crash; npm 11.21.1 installation succeeded and generated Prisma 7.10.1 client. Final Next.js version: 16.4.2; TypeScript 5.9.3; React 19.3.1. CLI checks caught a CommonJS/ESM import issue in `@next/env`; a default import fixed it and subprocess tests now cover that entrypoint. PowerShell's npm wrapper swallowed `--target`; documented commands use positional targets instead.

Windows automation sandbox restrictions initially blocked Next.js native workspace canonicalization and Vitest temporary-file renames. Re-running with approved normal filesystem access succeeded. Those failures are not passing checks and do not imply hosted services were tested.

| Command / check | Final result |
|---|---|
| `npx --yes npm@11.21.1 ci --fetch-retries=0 --fetch-timeout=30000` | PASS; clean lockfile install, Prisma client generated |
| `npm run check` | PASS; final run after all code changes |
| Lint within aggregate check | PASS; zero warnings |
| Typecheck within aggregate check | PASS; Prisma generation, Next typegen, TypeScript |
| `npm test` within aggregate check | PASS; 14/14 tests, three suites |
| `npm run db:validate` within aggregate check | PASS; Prisma schema valid |
| `npm run build` within aggregate check | PASS; production static `/` and not-found routes |
| `npm run data:validate` | PASS; 10 authors, 18 books, exact source checksum |
| Offline `prisma migrate diff --from-empty --to-schema ... --script --output ...` | PASS; generated initial DDL, then added custom clauses; not applied to a DB |
| `npm run env:check -- development` without configuration | EXPECTED STOP; missing fields reported clearly; no connection attempted |
| `npm run db:migrate -- development` without configuration | EXPECTED STOP; migration configuration rejected before connection |
| `npm.cmd run start -- --port 3100` plus localhost fetch | PASS; production `/` 200, disabled honest attachment UI, `/api/tickets` 404 |
| `npm.cmd run dev -- --port 3101` plus localhost fetch | PASS; development `/` 200 without credentials |
| `git diff --check` | PASS; no whitespace errors |

Local servers were stopped after smoke checks. These ad hoc scaffold checks are not the planned authenticated HTTP test suite. `next dev` also generated the framework's root `AGENTS.md` guidance; it contains no application functionality. No hosted results are inferred from offline validation.

## Dependency audit

Online `npm audit --json`: five high findings in a development-only chain (`braces` -> `micromatch` -> `fast-glob` -> Next ESLint plugin/config). Registry check returned braces 3.0.3 as latest; advisory includes that release. The suggested automated fix downgraded Next lint configuration across major versions and was not applied.

Online `npm audit --omit=dev --json`: zero production vulnerabilities at the verification date. Offline audit output was not used as a security result. Recheck current advisories before final submission and upgrade a compatible patched dependency when available.

## Unverified/external prerequisites

- Initial migration execution against hosted Supabase, custom Auth FK/privileges/checks and runtime-role SQL. Offline generation is not a database migration test.
- Database pooler/TLS connectivity, restricted-role permissions and Supabase public-signup settings.
- Login/logout, session refresh, role lookup, provisioning recovery and seed idempotency.
- REST/business authorization, lifecycle/concurrency, pagination and polling.
- Real/model/mock AI capabilities; no provider request has been executed.
- Deployment/live demo and Node 24 compatibility.
- Final rendered one-page write-up check. Current draft is intentionally short and will be rendered at delivery.

## Planned next layers

Integration tests use a dedicated hosted test project/database, never development/demo reset. Verify constraints, transactions, exact record round trips, account mappings and interrupted-provisioning recovery. Refuse destructive fixtures without explicit test-environment checks.

HTTP tests start Next.js on a test port, authenticate real test identities and call actual `/api/...` paths with cookies. Verify author A cannot access author B's books/tickets/messages; authors cannot use admin endpoints; sender spoofing fails; notes/drafts/events never appear in author DTOs; validation and error envelopes are consistent.

Lifecycle tests: assignment/message does not change status; explicit IN_PROGRESS; resolved author/admin replies do not reopen; resolved author reply attention survives acknowledgement races; CLOSED rejects replies even under close/reply concurrency; admins can reopen. AI tests: manual precedence under concurrent completion, bounded failures after persisted creation, cache reuse/regeneration, prompt injection fixtures, no automatic sends, editable manual fallback.

Playwright focuses on two-session author/admin conversation, ownership, notes isolation, manual AI review and near-real-time updates (target approximately six seconds for a visible detail view with five-second polling under normal conditions). Cover production nulls, zero royalties and empty/error/loading states. Live AI evaluations remain opt-in and report model/prompt/KB versions and measured results.
