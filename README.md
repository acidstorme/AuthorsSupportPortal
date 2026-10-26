# BookLeaf Author Support & Communication Portal

A Next.js App Router modular monolith using TypeScript, Tailwind/shadcn UI, Prisma, hosted Supabase Auth/PostgreSQL, Zod, TanStack Query and OpenAI, with deterministic mock mode.

## Submission overview

- **Local setup:** use Node.js 22.12+ (22.x) or 24.x and npm 10+, install with `npx --yes npm@11.21.1 ci`, copy `.env.example` to `.env.local`, then follow [hosted Supabase setup](#hosted-supabase-setup--only-supported-local-workflow) to configure, migrate and provision an isolated project. Run `npm run dev` and open http://localhost:3000. Local development uses hosted Auth/PostgreSQL; Docker is not required. Use `AI_MODE=mock` without an OpenAI key, or configure `AI_MODE=openai`, `OPENAI_API_KEY` and `OPENAI_MODEL` for paid requests. For a production build, run `npm run build` followed by `npm start`.
- **Architecture and rationale:** one Next.js application keeps deployment simple; separate HTTP, authorization, service, repository and AI boundaries keep business rules testable. Supabase supplies managed identity/PostgreSQL; Prisma supplies typed data access and migrations. Database ownership constraints, scoped queries and server-side roles protect author data. Polling and a fixed policy KB keep infrastructure proportionate to the assignment. See [architecture](docs/ARCHITECTURE.md) and [decisions](docs/DECISIONS.md).
- **AI prompt strategy:** classification uses explicit triage rules and a strict category/priority JSON schema. Drafting supplies versioned company policies and scoped book/public-conversation context, with instructions to treat ticket text as untrusted, preserve unknowns and propose rather than invent operational actions. Category/keyword selection retrieves relevant fixed KB sections; uncertain selection supplies the whole small KB. Unsupported questions should lead to clarification or team review, not invented policy. This is prompt guidance, not a guaranteed factuality check; admins review, edit and explicitly send every response. See [AI design](docs/AI_DESIGN.md).
- **AI error handling:** classification runs after ticket persistence, so provider failure does not lose the ticket. Calls have eight/fifteen-second classification/draft deadlines, no automatic SDK retries, schema/output checks, sanitized errors and per-ticket cooldowns. Draft failures preserve manual support and the previous saved draft. Manual classifications take precedence; fingerprints and conditional writes detect stale drafts/results. Real-provider errors never silently become mock output.
- **AI cost management:** the configurable default is `gpt-4o-mini`; classification/draft output caps are 150/700 tokens. Selected KB sections, bounded recent conversation, persisted draft reuse, duplicate claims and thirty-second per-ticket cooldowns reduce calls. Polling never generates AI output. Successful real calls log token usage/model/request ID. Current controls suit the demo, but there is no global spend cap or token-aware input ceiling. Production improvements include per-admin/global quotas, daily budget enforcement, token-aware trimming and model evaluation before changing models. See [AI budgets and limitations](docs/AI_DESIGN.md#budgets-observability-and-evaluation).
- **API documentation:** [API reference](docs/API.md) covers authentication, books, author/admin tickets and AI endpoints, with request/response contracts and errors.
- **Known limitations and next steps:** attachments and ticket linking are deferred; financial data is a snapshot rather than a payment ledger. Recent AI conversation context is bounded and broad live-model/adversarial evaluation remains outstanding. Production work would add operational monitoring, budget controls, broader security/load testing and durable background processing as demand grows. The [approach note](docs/WRITEUP.md) explains priorities, trade-offs and evolution; [testing](docs/TESTING.md) records verification scope.

## Live demo and implementation status

**Live demo:** [BookLeaf Author Support Portal](https://authors-support-portal.vercel.app/) · [Sign in](https://authors-support-portal.vercel.app/login)

The deployment uses the existing isolated Supabase assignment project. Reviewer author/admin accounts are listed under [Approved demo logins](#approved-demo-logins).

Implemented in code: shared email/password login, logout, server-side session refresh, HTTP-only cookies, verified Auth identity and database role lookup, protected author/admin landing pages, own-book lists and scoped book APIs, trusted author provisioning/two-admin bootstrap, idempotent source import and setup verification.

Uploads and ticket linking remain deferred. New tickets are OPEN; AI failure leaves them available for manual triage. The honest attachment placeholder sends/stores nothing. The PDF permits UI-only attachment support; actual upload is a bonus. Future attachment storage is Cloudflare R2.

Deployment configuration and the verified-TLS solution are documented in [DEPLOYMENT](docs/DEPLOYMENT.md). User-reported deployed results and independently executed local/hosted checks are distinguished in [TESTING](docs/TESTING.md).

## Prerequisites and first run

### Local delivery review

Run `npm run dev` with the reviewed hosted setup. On /admin, Created from/through filter creation dates in UTC; through includes the whole selected day. Oldest unresolved first selects OPEN/IN_PROGRESS and ascending creation time, retaining other filters. Reset filters clears search/date selections. Ticket rows show creation time. No migration or new runtime permission is needed.

Real-browser acceptance: `npm run test:portal:browser -- development` with a local app at APP_URL, system Edge, mock mode in both app/test shells and the CA exported before startup. This uses actual author/admin UI, real hosted records and polling without intercepted APIs or paid AI. It retains one labelled ticket, private note, public replies and events per run. The separate editor-preview regression remains `npm run test:ai:composer -- development` and intercepts ticket APIs.

The submission write-up is available as [one-page PDF](docs/WRITEUP.pdf) and [Markdown source](docs/WRITEUP.md). To regenerate optionally (Python 3.12 tested; not required to run/deploy the app):
```powershell
python -m pip install -r scripts/requirements-docs.txt
npm run docs:writeup
```
The renderer asserts exactly one A4 page and writes an ignored PNG preview to tmp/writeup-page.png for visual checking. Generation was verified using the listed dependency versions; the PDF was visually inspected.

### Review Milestone 5

Keep `AI_MODE=mock` for repeatable local review. Create a ticket as an author, open it as an admin and inspect the MOCK classification/proposed draft. Edit the response and explicitly send; the author should see only the sent text. Reopening the admin detail shows the saved AI response in a preview without filling the editor; changed context marks it stale and requires explicit regeneration. Ordinary five/ten-second polling never invokes generation. Requests attempted within thirty seconds of another attempt return a cooldown error; manual writing stays available. CLOSED must be reopened before drafting/sending.

On ticket load, only newly generated responses fill an empty editor; cached responses appear in the AI generated response preview without opening the modal. Explicitly loading or regenerating a draft fills an empty editor. If it contains text, that text stays intact and an AI generated response one-line preview appears below the draft buttons. View opens the complete read-only response; Use generated text in editor explicitly replaces the editor. The focused system-Edge browser regression is `npm run test:ai:composer -- development` (requires the local app, configured admin and installed Edge; ticket/AI requests are intercepted).

For real calls set `AI_MODE=openai`, `OPENAI_API_KEY` and your approved `OPENAI_MODEL` in ignored .env.local, then restart Next.js. The current default gpt-4o-mini alias passed a real smoke on 24 October 2026 but is listed as deprecated by OpenAI; it remains configurable and was retained with user approval. Real failure never silently falls back to mock. Core Auth/DB remain usable if optional AI configuration is invalid, while `npm run env:check` deliberately flags that configuration.

No new database migration, grant, account provisioning or seed is needed. To apply CA trust, set it in **each shell before Node starts** (putting it only in .env.local is too late for Node's startup trust):
```powershell
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path .\certs\prod-ca-2021.crt).Path
npm run dev
```
This project-specific CA path passed the agent's hosted safety check. Keep sslmode=verify-full. For another project, obtain its trusted certificate through Supabase rather than disabling verification. The Next.js Prisma runtime now loads the bundled CA explicitly, or uses the server-only DATABASE_CA_CERT PEM override; it does not require NODE_EXTRA_CA_CERTS. Workstation migration/setup scripts can still need the shell setting above. For Vercel, paste the full public PEM into Production DATABASE_CA_CERT and follow [deployment TLS instructions](docs/DEPLOYMENT.md#apply-the-tls-fix-before-redeploying). `npm run db:verify:runtime` performs a read-only Prisma identity/login-query check.

With the app running, `npm run test:ai:hosted -- development` verifies the deterministic workflow against hosted Auth/PostgreSQL and retains one labelled test ticket/draft/reviewed reply. Both app/test processes must use mock mode and the same APP_URL. `npm run test:ai:live -- live` makes **two paid synthetic requests** using the existing configured model/key (no author records or DB writes); the final live argument is required. It prints the synthetic draft for human grounding review, not credentials. Neither command provisions accounts or sends email.

### Review Milestone 4

Run `npm run dev`, sign in as either admin, and open /admin. Filter/search the queue, take/unassign a ticket, apply manual classification and explicit statuses, add a private note and read audit history. Use a separate browser session as the ticket's author: a reply while RESOLVED must preserve status and light the admin attention indicator; CLOSED must reject replies from both roles. Reopen explicitly with OPEN. Author pages must never show private notes. No new migration, environment variable or runtime permission is required.

`npm run test:admin:hosted -- development` performs opt-in actual-HTTP lifecycle tests against APP_URL, after full project/migration/email/runtime safety preflight. It retains one labelled ticket, a private note, public replies and audit events. The close/reply race accepts either valid serialization; once closed, new replies must fail. It never provisions accounts, sends mail, resets passwords or deletes records. Start the app and configure certificate trust first.

### Author ticket review

With the reviewed hosted setup already seeded, run `npm run dev`, sign in as an author, and use **Create a ticket** on /author. Test general and owned-book inquiries, filtering, detail and replies. The financial book details preserve source nulls/decimal strings. New tickets remain awaiting triage until admin/AI work. There is no new migration or runtime-role SQL change for this milestone.

`npm run test:tickets:hosted -- development` runs opt-in actual-HTTP ticket checks against APP_URL after full project/email/runtime safety preflight. It creates and retains two labelled synthetic demo tickets plus two public replies per successful run; it does not delete records or modify accounts/statuses. Start the app first. Never run against real customer data. For a nondefault port in Windows, run `node node_modules/next/dist/bin/next dev --port 3103` and set APP_URL in that shell and the test shell to the same origin. `npm run test:smoke -- http://localhost:3103` needs no sign-in. Use npm run check for offline unit/handler, type and build validation.

- Node.js 22.12+ in 22.x, or 24.x; tested runtime is 22.17.0 (`.nvmrc`).
- npm 10+; npm 11.5.2 previously hit an installation resolver bug. A clean lockfile install succeeded using npm 11.21.1.
- An isolated hosted Supabase project; prefer separate development and deployed-demo projects. No Docker or local Supabase/PostgreSQL.
- OpenAI credentials are unnecessary in mock mode; real mode requires a private server-side key and account/model access.

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

The deployed portal is available at https://authors-support-portal.vercel.app/. The user verified hosted provisioning and author/admin sign-ins during Milestone 2 review, and confirmed deployed login/application use after the TLS fix. The credential table below describes approved isolated-demo configuration; existing passwords are never reset by setup.

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
| AI_MODE | mock default (deterministic labelled tests) or openai (real paid calls) |
| OPENAI_MODEL | Configurable model; default gpt-4o-mini |
| OPENAI_API_KEY | Server-only key required in openai mode for classification and drafts |

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
| npm run test:ai:hosted -- development | Hosted MOCK AI workflow; retains a labelled ticket/draft/reviewed reply |
| npm run test:ai:live -- live | Two paid synthetic provider calls; no Auth/DB or author records |
| npm run test:portal:browser -- development | Actual Edge author/admin/polling delivery flow; retains labelled records |
| npm run docs:writeup | Optional Python-based one-page PDF/preview renderer |
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
- **Deferred:** R2 attachments, ticket links, full accounting, password recovery/self-registration. See TESTING for actual hosted results versus mocked tests. Broad live-model accuracy/adversarial evaluation and broader browser coverage remain future work; human review is mandatory.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Plan](docs/IMPLEMENTATION_PLAN.md) · [AI design](docs/AI_DESIGN.md) · [Tests/results](docs/TESTING.md) · [Decisions](docs/DECISIONS.md) · [Interview guide](docs/INTERVIEW_GUIDE.md) · [Vercel handoff](docs/DEPLOYMENT.md) · [Write-up source](docs/WRITEUP.md) · [One-page PDF](docs/WRITEUP.pdf)

The core application is deployed on Vercel using the existing isolated Supabase project; see DEPLOYMENT for configuration and TESTING for verification scope. The user confirmed that all final deployed checks and flows work correctly on 26 October 2026. Cloudflare R2 and ticket linking remain deferred extensions. Submission handoff includes public repository access and the evaluator's collaborator email when supplied.
