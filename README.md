# BookLeaf Author Support & Communication Portal

A Next.js modular monolith using hosted Supabase Auth/PostgreSQL, Prisma, and planned OpenAI assistance.

## Current status: Milestone 1

Implemented: a runnable foundation page, Tailwind/shadcn-compatible UI, TanStack Query provider, environment validation, lazy Supabase/Prisma client factories, seven-table Prisma schema, initial migration, exact source JSON validation, and unit tests.

**Not implemented:** login/logout, provisioning, database seeding, author/admin portals, business REST endpoints, ticket services, real/mock AI behavior, deployment, or uploads. Schema foundations do not mean these features work.

The attachment placeholder is disabled and stores nothing. The assignment permits UI-only attachments; actual upload is a bonus. Future storage will use Cloudflare R2. No attachment or ticket-link tables exist.

## Prerequisites

- Node.js 22.12+ within 22.x, or 24.x. Tested on **22.17.0**, pinned in `.nvmrc`.
- npm 10+. npm 11.5.2 encountered a resolver bug; installation succeeded using npm 11.21.1.
- A hosted Supabase project for future integration. Prefer separate development and deployed-demo projects. **No Docker, local Supabase, or local PostgreSQL required.**
- OpenAI API key only for future real AI mode; mock behavior is planned, not yet implemented.

## Run the current project

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The foundation page needs no credentials and does not access services. Sign-in is disabled. No book or author records are displayed yet.

If npm 11.5.x fails with `Cannot read properties of null (reading 'edgesOut')`:

```bash
npx --yes npm@11.21.1 ci
```

Use the committed lockfile for reproducibility. See [test results](docs/TESTING.md) for commands actually verified.

## Local app + hosted Supabase setup

This is the only supported integration workflow. Next.js runs locally; Auth and PostgreSQL run in a hosted project.

1. Create an isolated development Supabase project. Obtain its project reference, API URL/key and database connection strings from the Connect panel.
2. Disable public signup in Authentication settings. Set development Site URL to `http://localhost:3000` and permit only intended redirect URLs. Email/password will be the login method.
3. Keep `app` out of the Data API exposed schemas. Browser clients use Supabase Auth only; database access goes through Next.js and Prisma.
4. Copy the template, then edit `.env.local`:

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS/Linux
cp .env.example .env.local
```

5. Configure `DATABASE_URL` for a restricted runtime login and pooled connection. Configure `DIRECT_URL` for a trusted DDL login through a direct connection or session pooler (usually port 5432). Both require `schema=app&sslmode=verify-full`. Percent-encode password special characters.
6. Validate and migrate:

```bash
npm run env:check
npm run env:check -- development
npm run db:validate
npm run db:status -- development
npm run db:migrate -- development
```

`db:status` may exit nonzero for pending migrations. `db:migrate` uses **migrate deploy**, never reset or db push. The positional target must match `APP_ENV`; both DB URLs and the Auth URL must match `SUPABASE_PROJECT_REF`. Configuration validation makes no network requests.

7. After migrating, review and run `scripts/sql/runtime-role.sql` in the project's SQL editor as a trusted owner. Set a random password for the new runtime role through a trusted session and use it in `DATABASE_URL`. The SQL deliberately never sets/resets passwords. Do not deploy `DIRECT_URL` to the web runtime.
8. Run `npm run dev`. Milestone 1 has no login or database-backed page. Provisioning/seed commands will be added in Milestone 2; they do not exist yet.

**Unverified:** hosted migration application, runtime-role SQL, live Auth and database connectivity. No hosted credentials were supplied. Successful offline checks are not proof of hosted setup.

### Targeting the deployed demo

Use a separate project and environment values. Set `APP_ENV=demo`, HTTPS `APP_URL`, and matching Supabase configuration. From a trusted shell with that environment loaded:

```bash
npm run env:check -- demo
npm run db:migrate -- demo
```

Standalone scripts use Next.js environment-file precedence; existing shell values override `.env.local`. Do not mix projects. Inspect the target/reference printed before migration. `APP_ENV` is independent of `NODE_ENV`. Targets are positional to avoid PowerShell/npm flag forwarding issues; `--target` is also accepted when invoking the script directly.

No deployment or demo credentials exist yet. Add verified demo access after it works. Publish only intentionally disposable application credentials, never privileged keys or database passwords.

## Environment variables

All template values are safe placeholders. Never commit `.env.local`.

| Variable | Purpose / when needed |
|---|---|
| `APP_ENV` | `development`, `demo`, `test`; required for integration checks and migration targeting |
| `APP_URL` | Local origin or HTTPS demo origin; future cookie/origin policy |
| `SUPABASE_PROJECT_REF` | Twenty-letter hosted project reference |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted Auth URL matching the reference |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key; legacy anon key accepted |
| `DATABASE_URL` | Restricted runtime PostgreSQL connection |
| `DIRECT_URL` | Trusted direct/session migration connection; migrations only |
| `AI_MODE` | `mock` default or `openai`; validated now, behavior planned |
| `OPENAI_MODEL` | Planned default `gpt-4o-mini` |
| `OPENAI_API_KEY` | Server-only; validator requires it in openai mode |
| `SUPABASE_SERVICE_ROLE_KEY` | Future trusted provisioning only; not needed by web runtime |
| `DEMO_AUTHOR_PASSWORD` | Future shared password for newly created synthetic authors |
| `DEMO_ADMIN_EMAIL` | Future separate synthetic admin identity |
| `DEMO_ADMIN_PASSWORD` | Future separate admin password |

Only the two `NEXT_PUBLIC_*` values may enter browser bundles. Restart development after environment changes; rebuild for changed public values. The service-role key and demo passwords must stay out of web deployment variables.

## Source data and account safety

`data/bookleaf-sample.json` is a byte-for-byte copy of the supplied file: ten authors and eighteen books, including two in production. IDs, contact fields, dates, nulls, financial snapshots and platform arrays are preserved.

All supplied emails use **email.com**, which is not reserved and could identify real people. Future trusted provisioning will use `auth001@bookleaf-demo.example` through `auth010@bookleaf-demo.example`, while preserving original `author_profiles.email`. No accounts have been created and no emails sent.

```bash
npm run data:validate
```

Future setup must be idempotent, stop on identity mapping conflicts, recover across separate Auth/Prisma operations, and never reset existing passwords during ordinary seed runs.

## Commands

| Command | Behavior |
|---|---|
| `npm ci` | Locked installation and Prisma generation |
| `npm run dev` | Development server |
| `npm run db:generate` | Generate ignored Prisma client offline |
| `npm run db:validate` | Validate schema offline |
| `npm run env:check` | Validate runtime config without network access |
| `npm run env:check -- development` | Also validate migration config |
| `npm run db:status -- development` | Read hosted migration status |
| `npm run db:migrate -- development` | Apply committed hosted migrations |
| `npm run data:validate` | Validate source JSON/checksum; no writes |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run typecheck` | Prisma/Next generation and TypeScript validation |
| `npm test` / `npm run test:watch` | Unit tests / watch mode |
| `npm run build` / `npm run start` | Build / serve production locally |
| `npm run check` | Lint, types, tests, schema validation and build |

```bash
npm run build
npm run start
```

HTTP, integration and Playwright suites are planned; no passing results or commands are advertised before implementation.

## Troubleshooting

- **Invalid environment:** replace every `replace-me` placeholder before integration checks. The scaffold page itself needs no variables.
- **Project mismatch:** API URL, pooler username/direct hostname and project reference must agree; copy from the same project's Connect panel.
- **IPv6/network errors:** use hosted session pooling on port 5432 for migrations if direct connectivity needs unavailable IPv6.
- **TLS errors:** preserve verification; check hostname and local CA trust. If required, configure `NODE_EXTRA_CA_CERTS` with the trusted Supabase CA file. Do not disable certificate verification.
- **Password errors:** database passwords differ from API keys. Encode password characters; custom pooler usernames include the project reference.
- **Permission denied:** apply migrations through the DDL connection, then review runtime-role grants. Keep runtime credentials separate from the database owner.
- **Migration failure:** inspect the actual failing statement. The migration expects Supabase's existing `auth.users`, `anon` and `authenticated`. Never use reset against development/demo data.
- **npm resolver crash:** use the newer npm command above; do not rewrite the lockfile with an incompatible resolver.
- **Windows sandbox EPERM/path errors:** this environment required elevated execution for Next.js native path resolution and Vitest temporary-file renames. Successful verification used normal filesystem access afterward.
- **Audit findings:** five high findings affect a dev-only Next ESLint/glob/braces chain; production audit is clean. No patched braces release existed at verification. See TESTING; do not run `audit fix --force` blindly.

## Documentation

- [Revised implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture, ER diagram and security](docs/ARCHITECTURE.md)
- [API planned contracts](docs/API.md)
- [AI design](docs/AI_DESIGN.md)
- [Testing, results and gaps](docs/TESTING.md)
- [Decisions and alternatives](docs/DECISIONS.md)
- [Interview guide](docs/INTERVIEW_GUIDE.md)
- [One-page write-up draft](docs/WRITEUP.md)

No external workflow is marked complete before it has been tested. Milestone 2 begins only after Milestone 1 review.

