# BookLeaf Author Support & Communication Portal

A Next.js App Router modular monolith using TypeScript, Tailwind/shadcn UI, Prisma, hosted Supabase Auth/PostgreSQL, Zod and TanStack Query. OpenAI integration is planned for a later milestone.

## Current status — Milestone 4

Implemented in code: shared email/password login, logout, server-side session refresh, HTTP-only cookies, verified Auth identity and database role lookup, protected author/admin landing pages, own-book lists and scoped book APIs, trusted author provisioning/two-admin bootstrap, idempotent source import and setup verification.

The user reviewed Milestones 2 and 3: hosted setup, author/admin access and author ticket core. Milestone 4 adds the admin queue, effective category/priority filters, self-assignment, manual triage, explicit lifecycle controls, private notes, audit history and resolved-reply attention. See [TESTING](docs/TESTING.md) for independently executed checks and remaining gaps.

AI classification/drafts, deployment, uploads and ticket linking remain deferred. New tickets are OPEN and awaiting triage; admins can classify manually. No AI runs yet. The honest attachment placeholder sends/stores nothing. The PDF permits UI-only attachment support; actual upload is a bonus. Future attachment storage is Cloudflare R2.

## Prerequisites and first run

### Review Milestone 4

Run `npm run dev`, sign in as either admin, and open /admin. Filter/search the queue, take/unassign a ticket, apply manual classification and explicit statuses, add a private note and read audit history. Use a separate browser session as the ticket's author: a reply while RESOLVED must preserve status and light the admin attention indicator; CLOSED must reject replies from both roles. Reopen explicitly with OPEN. Author pages must never show private notes. No new migration, environment variable or runtime permission is required.

`npm run test:admin:hosted -- development` performs opt-in actual-HTTP lifecycle tests against APP_URL, after full project/migration/email/runtime safety preflight. It retains one labelled ticket, a private note, public replies and audit events. The close/reply race accepts either valid serialization; once closed, new replies must fail. It never provisions accounts, sends mail, resets passwords or deletes records. Start the app and configure certificate trust first.

### Author ticket review

With the reviewed hosted setup already seeded, run `npm run dev`, sign in as an author, and use **Create a ticket** on /author. Test general and owned-book inquiries, filtering, detail and replies. The financial book details preserve source nulls/decimal strings. New tickets remain awaiting triage until admin/AI work. There is no new migration or runtime-role SQL change for this milestone.

`npm run test:tickets:hosted -- development` runs opt-in actual-HTTP ticket checks against APP_URL after full project/email/runtime safety preflight. It creates and retains two labelled synthetic demo tickets plus two public replies per successful run; it does not delete records or modify accounts/statuses. Start the app first. Never run against real customer data. For a nondefault port in Windows, run `node node_modules/next/dist/bin/next dev --port 3103` and set APP_URL in that shell and the test shell to the same origin. `npm run test:smoke -- http://localhost:3103` needs no sign-in. Use npm run check for offline unit/handler, type and build validation.

- Node.js 22.12+ in 22.x, or 24.x; tested runtime is 22.17.0 (`.nvmrc`).
- npm 10+; npm 11.5.2 previously hit an installation resolver bug. A clean lockfile install succeeded using npm 11.21.1.
- An isolated hosted Supabase project; prefer separate development and deployed-demo projects. No Docker or local Supabase/PostgreSQL.
- OpenAI credentials are unnecessary through Milestone 4.

```bash
npx --yes npm@11.21.1 ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) or [the shared login](http://localhost:3000/login). The public page and unauthenticated login page render without service credentials; actual sign-in needs completed hosted setup.

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS/Linux
cp .env.example .env.local
```

If you already have `.env.local`, edit it rather than overwriting its values. It is Git-ignored. Remove the obsolete singular admin-email setting and use `DEMO_ADMIN1_EMAIL` / `DEMO_ADMIN2_EMAIL`.

## Hosted Supabase setup — only supported local workflow

Next.js runs locally; Auth and PostgreSQL run in the selected hosted project.

1. Create/select an isolated assignment project. Obtain its reference, public API URL/key and database connection details from the dashboard's Connect panel.
2. Keep email/password sign-in enabled. Disable **public signup** and anonymous/social providers. Set development Site URL to `http://localhost:3000`; use the real HTTPS origin for the deployed demo. Disabling “Confirm email” is not an outbound-mail block.
3. Keep `app` out of Data API exposed schemas. Browser code never accesses the database or Supabase Auth tokens directly.
4. Bootstrap configuration needs only `APP_ENV`, `SUPABASE_PROJECT_REF` and `DIRECT_URL`. Use a trusted DDL login through the direct endpoint or session pooler (usually port 5432), matching the project reference, with `schema=app&sslmode=verify-full`. `DATABASE_URL` may remain unset or a placeholder until the runtime role exists. Auth and AI configuration are not migration prerequisites.
5. If TLS reports an untrusted/self-signed chain, download the database CA from **Database Settings → SSL Configuration** and add `sslrootcert=<URL-encoded absolute certificate path>` to the connection strings. Alternatively set `NODE_EXTRA_CA_CERTS` in the shell before starting Node. Do not disable certificate verification. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
6. Validate and apply committed migrations:
```bash
npm run env:check -- development
npm run db:status -- development
npm run db:migrate -- development
```
This targeted environment check validates migration configuration only. Pending migrations can make status exit nonzero. Migration uses `DIRECT_URL` and `migrate deploy`, never reset/db push. Targets are positional to avoid PowerShell/npm flag forwarding problems. Existing shell variables override environment files; inspect the printed target/reference before privileged setup.

7. In the selected project's SQL Editor, review/run [runtime-role.sql](scripts/sql/runtime-role.sql). It creates a restricted login if absent and grants required permissions, without setting/resetting passwords. For a newly created role, set a strong random database password through a trusted SQL session and put it in `DATABASE_URL`. This database password is separate from the demo application password. Existing overprivileged roles require deliberate review; the setup preflight rejects them.
8. Configure `DATABASE_URL` with that restricted login (transaction pooler usually port 6543), matching the project reference with `schema=app&sslmode=verify-full`. Complete `APP_URL` and public Supabase URL/key, then run `npm run env:check` for runtime validation. This still rejects owner credentials. Complete the email-safety procedure below **before provisioning any confirmed demo identities**.
9. Provide the trusted service-role/secret key and approved demo variables, then run:
```bash
npm run auth:provision -- development
npm run admin:bootstrap -- development
npm run db:seed -- development
npm run setup:verify -- development
npm run dev
```
No manual creation of twelve Auth users is required. After prerequisites and safety checks, the aggregate command performs migration deploy, author provisioning, both admins, import and verification:
```bash
npm run demo:setup -- development
```
The aggregate command does not bypass project, email, role or identity checks. First-time role/hook SQL still needs the trusted dashboard setup above.

### Required outbound-email safety

The exact `email.com` identities are explicitly approved only for this isolated demo. Do not rely on email-confirmation settings, hiding reset links, default SMTP recipient limits, or invalid SMTP credentials to guarantee safety.

1. After migrations/runtime-role setup, run [block-auth-emails.sql](scripts/sql/block-auth-emails.sql) in SQL Editor.
2. In **Authentication → Hooks → Send Email**, choose PostgreSQL function `app.block_demo_auth_email`, enable and save it. The function returns an explicit rejection for every event and performs no SMTP/HTTP operation.
3. Run `npm run setup:safety`. This read-only command checks the runtime role/permissions, installed function body/permissions and signup setting. It can directly invoke only the reviewed non-sending function.
4. Verify separately in the dashboard that this function is the **active Send Email hook**. Function existence alone cannot prove activation. An enabled Send Email hook replaces SMTP; see [Supabase's behavior table](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
5. Only after both checks, set `DEMO_EMAIL_DISABLED_CONFIRMED=true` and `DEMO_APPROVED_PROJECT_REF` to the approved project's reference. Until then, leave the acknowledgement false.

Provisioning also checks the reviewed function, restricted runtime connection, signup-disabled setting and applied migration checksums before any Auth creation. Without Management API access it cannot independently read dashboard hook activation; the explicit acknowledgement records that manual verification. No recovery/invite/OTP/email-change API is implemented or called by setup. Admin creation uses `createUser({email_confirm:true})`, never invitations. Do not trigger a recovery request to a dataset address as an exploratory test before the block is verified.

### Development and deployed demo

Use separate projects and credentials. For demo, set `APP_ENV=demo`, HTTPS `APP_URL`, matching Supabase URLs and that project's approval reference. Repeat the SQL/hook configuration for that project, then use the same commands with positional target `demo`. Do not deploy `DIRECT_URL`, service-role credentials, setup acknowledgements or seed passwords to the web runtime.

No deployment/live demo URL is available yet. The user verified hosted provisioning and author/admin sign-ins during Milestone 2 review. The credential table below describes approved isolated-demo configuration; existing passwords are never reset by setup.

## Approved demo logins

All passwords come from the environment for newly created accounts; ordinary reruns never reset existing credentials.

| Account | Email | Initial password | Role |
|---|---|---|---|
| Example author | priya.sharma@email.com | Bookleaf123 | AUTHOR |
| Other authors | Exact emails in the supplied JSON | Bookleaf123 | AUTHOR |
| Administrator 1 | admin1@email.com | Bookleaf123 | ADMIN |
| Administrator 2 | admin2@email.com | Bookleaf123 | ADMIN |

Authors land at `/author` and see their identity and books. Both admins land at `/admin` with identical authorization and no author profile. These intentionally public disposable credentials must never be reused with real user data.

## Environment reference

| Variable | Purpose |
|---|---|
| APP_ENV | development, demo or test; explicit setup target |
| APP_URL | Local app origin or deployed HTTPS origin; cookie/origin policy |
| SUPABASE_PROJECT_REF | Expected hosted project reference |
| NEXT_PUBLIC_SUPABASE_URL | Project API/Auth URL matching reference |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public publishable key; legacy anon key accepted |
| DATABASE_URL | Restricted bookleaf_runtime PostgreSQL connection |
| DIRECT_URL | Trusted migration/provisioning DB connection; standalone tooling only |
| SUPABASE_SERVICE_ROLE_KEY | Trusted Auth Admin API key; scripts only |
| DEMO_AUTHOR_PASSWORD | Approved initial author password; example defaults to Bookleaf123 |
| DEMO_ADMIN1_EMAIL | First admin identity; default admin1@email.com |
| DEMO_ADMIN2_EMAIL | Second admin identity; default admin2@email.com |
| DEMO_ADMIN_PASSWORD | Approved initial admin password; example defaults to Bookleaf123 |
| DEMO_APPROVED_PROJECT_REF | Explicit approval of an isolated demo project |
| DEMO_EMAIL_DISABLED_CONFIRMED | false until hook installation AND dashboard activation verified |
| AI_MODE | mock default or openai; AI behavior not implemented yet |
| OPENAI_MODEL | Planned default gpt-4o-mini |
| OPENAI_API_KEY | Required by validation only in openai mode; no M2 AI calls |

Only public Supabase URL/key are browser-safe; the M2 client does not instantiate a browser Auth SDK. Tokens are HTTP-only cookies, never returned by login/me APIs or stored in browser localStorage. Do not log secrets or commit environment files. Restart after changes; public build-time changes require a rebuild.

## Commands

| Command | Behavior |
|---|---|
| npm run env:check | Validate runtime configuration, no connections |
| npm run env:check -- development | Validate migration-only configuration and explicit target/project; no runtime credentials required |
| npm run env:check:demo -- development | Validate privileged demo settings/acknowledgements without network calls |
| npm run setup:safety | Read-only runtime-role/email-function/signup diagnostics; no accounts or mail |
| npm run db:generate / db:validate | Offline Prisma generation / schema validation |
| npm run db:status -- development | Hosted migration status |
| npm run db:migrate -- development | Apply committed migrations |
| npm run auth:provision -- development | Exactly ten source-email authors, safely restartable |
| npm run admin:bootstrap -- development | Exactly two configured administrators, no promotions |
| npm run db:seed -- development | Idempotent exact profile/book import; ticket records untouched |
| npm run setup:verify -- development | Auth/app counts, roles, UUID mappings, every source field |
| npm run demo:setup -- development | Guarded aggregate setup |
| npm run data:validate | Original JSON schema and byte checksum |
| npm run lint / typecheck / test | Local lint / types / deterministic tests |
| npm run check | Lint, types, unit tests, schema validation, build |
| npm run test:hosted -- development | Opt-in live HTTP tests against a running app and completed setup; no account creation |
| npm run test:smoke | Anonymous local HTTP checks against a running app; no hosted calls |
| npm run test:tickets:hosted -- development | Opt-in hosted ticket checks; retains two labelled demo tickets/two replies |
| npm run test:admin:hosted -- development | Opt-in hosted admin/lifecycle checks; retains one labelled ticket/note/replies/history |
| npm run dev | Local development server |
| npm run build / start | Build / run production locally |

Hosted HTTP tests use Playwright's request client and need no downloaded browser binary. They verify all twelve configured logins, role/landing behavior, HTTP-only cookies, author/admin isolation, source book ownership, same-origin protection and logout. They create sessions only. No passing hosted result is claimed until run.

## Troubleshooting and limits

- **Incomplete configuration:** template values cannot be used for integration. APIs return sanitized 503 for server configuration failures.
- **Project mismatch:** Auth URL, direct host/pooler username and reference must agree. Setup requires explicit target and project acknowledgement.
- **Restricted-role errors:** the runtime URL must use bookleaf_runtime, not postgres; inspect role SQL and privileges. Setup credentials remain separate.
- **Schema app does not exist:** apply the initial migration first, then runtime-role.sql, then block-auth-emails.sql. Do not create an empty schema manually or skip Prisma migration history. Use `npm run env:check -- development` before migrating; the bare `npm run env:check` validates runtime credentials after role setup. Migration never requires `DATABASE_URL`.
- **TLS trust:** add the downloaded Supabase CA; keep hostname and CA verification. Direct IPv6 unavailable? Use the hosted session pooler on port 5432.
- **Existing email conflict:** an unmarked Auth identity is never adopted just by email. Use a clean isolated project or investigate ownership; do not silently elevate, delete or reset it.
- **Partial provisioning:** rerun the same guarded command. Trusted Auth metadata permits reconciliation after the DB step failed. No account deletion is used as compensation.
- **Existing password changed:** ordinary setup does not restore demo defaults. Investigate deliberately; hosted login tests may correctly fail.
- **Login throttling:** provider rate limits may return 429. Avoid repeated live credential attempts; local tests use mocks.
- **Logout:** clears all local session-cookie chunks and revokes that refresh session. Already issued access JWTs may remain valid until expiry; this is not an application-wide immediate revocation system.
- **Windows sandbox:** native Next path resolution and Vitest cache operations required elevated tool execution during verification.
- **Dependency audit:** M1 recorded five high dev-only Next ESLint/glob/braces findings and zero production findings. No new dependency was added in M2; review current advisories before delivery.
- **Deferred:** AI, R2 attachments, ticket links, full accounting, password recovery/self-registration, deployment. Hosted ticket integration has been blocked by certificate trust in the agent process; see TESTING for latest executed results. Mocked ownership/lifecycle tests do not establish real PostgreSQL concurrency.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Plan](docs/IMPLEMENTATION_PLAN.md) · [AI design](docs/AI_DESIGN.md) · [Tests/results](docs/TESTING.md) · [Decisions](docs/DECISIONS.md) · [Interview guide](docs/INTERVIEW_GUIDE.md) · [One-page write-up draft](docs/WRITEUP.md)

Milestone 4 stops for review before Milestone 5 structured AI classification and grounded, editable, cached response drafts.
