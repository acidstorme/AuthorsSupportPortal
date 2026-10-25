# Vercel deployment handoff

Status (26 October 2026): Live at [https://authors-support-portal.vercel.app/](https://authors-support-portal.vercel.app/), using the existing isolated Supabase assignment project. After the Prisma TLS fix, the user confirmed successful deployment, login and application use. Deployment and remote configuration were performed by the user. The agent's production-mode Prisma checks were executed locally against hosted Supabase; a complete independent deployed acceptance run is not claimed.

## Files and build

- vercel.json selects Next.js, the previously tested npm 11.21.1 clean install, and npm run build. Build generates Prisma but never runs migrations, provisioning or seed.
- .vercelignore excludes local environment files, setup/test scripts, data and documentation from CLI source upload. Privileged setup code is not needed by runtime functions. No secrets belong in vercel.json or Git.
- next.config.ts traces public certs/*.crt into server function artifacts. Local build trace verification confirmed the CA in the login function. Existing Node Route Handlers keep maxDuration=60 for ticket creation/classification/drafting. The [Vercel duration guide](https://vercel.com/docs/functions/configuring-functions/duration) supports per-route maxDuration; confirm the selected account's limits before publication.
- Choose Node.js **22.x** in Vercel Project Settings (tested locally: 22.17.0); Node 24 is permitted by engines but unverified. Keep the root directory at the repository root. Region should be close to the selected Supabase project; no region is guessed in config.

## Selected deployment and remaining review

1. Hosting: Vercel. Stable HTTPS production origin: https://authors-support-portal.vercel.app. Set Production APP_URL to this exact origin.
2. Supabase: user selected the existing isolated assignment project. A separate demo project remains a future isolation improvement.
3. Real OpenAI mode/model/key or clearly labelled mock demo. Real mode needs account quota and spending monitoring. The current model alias passed a smoke but is listed as deprecated; do not silently replace it.
4. Whether the Vercel URL is accessible to reviewers without a Vercel team login. Check deployment-protection settings deliberately before sharing.

## Configure hosted demo data first

For a separate project, follow README bootstrap order using that project's explicit target demo: migrations via DIRECT_URL; runtime-role SQL/password; restricted DATABASE_URL; email-block SQL plus active Send Email hook; disabled signup; approved reference and email acknowledgement; provisioning, admin bootstrap, exact seed and verification. APP_ENV=demo requires HTTPS APP_URL. Keep .env.local's development values intact; use a separate shell/session with all demo-specific variables explicitly configured. Project/role/target checks must pass before any write. Never reset existing passwords or assign roles through the browser.

If reusing the development project is explicitly approved, verify its inventory and email protections instead of creating duplicate accounts. Existing setup commands remain idempotent. Do not delete the labelled local test history just to make the demo look clean; any cleanup needs a separate reviewed scope.

## Production environment variables

Set these in **Vercel Production** for the chosen project, then redeploy after changes. [Vercel environment variables](https://vercel.com/docs/environment-variables) apply to selected deployment environments; avoid exposing demo credentials through unrelated previews.

| Variable | Production value/source |
|---|---|
| APP_ENV | demo |
| APP_URL | Exact stable HTTPS origin, no guessed preview URL; used for same-origin mutations and secure cookies |
| SUPABASE_PROJECT_REF | Selected demo project's reference |
| NEXT_PUBLIC_SUPABASE_URL | Matching selected project Auth URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Matching publishable/legacy anon key; not service-role |
| DATABASE_URL | Selected project's bookleaf_runtime transaction-pooler URL; schema=app and sslmode=verify-full |
| DATABASE_CA_CERT | Complete PEM contents of certs/prod-ca-2021.crt, including BEGIN/END CERTIFICATE lines; server-only, Production scope |
| AI_MODE | openai or explicitly labelled mock |
| OPENAI_MODEL | Approved available model; required for intended real-mode choice |
| OPENAI_API_KEY | Private server-side API key, required only for openai mode |

Do **not** upload DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_* passwords/acknowledgements or provisioning credentials to the web runtime. They are only for a trusted setup workstation. Do not use a postgres owner connection as DATABASE_URL. Never use NEXT_PUBLIC_ for privileged keys.

### Apply the TLS fix before redeploying

1. In Vercel Project Settings → Environment Variables, add **DATABASE_CA_CERT**, scoped to **Production**. Open `certs/prod-ca-2021.crt` locally and paste the complete public PEM certificate, including both delimiter lines. Raw multiline PEM is supported; literal `\n` separators are also accepted. This is a public trust certificate, not a private key. Do not use a NEXT_PUBLIC_ variable.
2. Keep DATABASE_URL on the same project's transaction pooler, port **6543**, with the **bookleaf_runtime.<project-ref>** username, existing encoded password, and `?schema=app&sslmode=verify-full`. Remove obsolete sslrootcert/sslcert/sslkey path parameters. Do not switch to the owner role. The application validates this original URL, then supplies its host, port, credentials and database directly to pg with mandatory TLS settings; query-string overrides cannot replace them.
3. Remove any Windows-path NODE_EXTRA_CA_CERTS setting from Vercel. No application code sets this variable. Keep certificate verification enabled; do not configure NODE_TLS_REJECT_UNAUTHORIZED=0.
4. Deploy the reviewed source containing this fix after saving the Production variables. Do not run migrations or reseed for this fix. Keep all other existing Auth/AI/project settings intact.
5. Attempt author and admin login. Runtime logs should contain `database_tls_configured`, `caSource: environment`, and both verification flags true, followed by successful login requests. This configuration log alone does not prove connectivity; successful login performs the actual Prisma user lookup. Do not paste credentials or full database URLs into logs/chat.

Prisma/client/adapter versions inspected: **7.10.1**; pg: **8.23.1**. The adapter uses explicit `ssl.ca`, `rejectUnauthorized: true`, Node's standard `checkServerIdentity`, and the URL hostname as SNI. This avoids [pg's documented connection-string SSL overwrite behavior](https://node-postgres.com/features/ssl). No adapter or ORM replacement is needed. If DATABASE_CA_CERT is absent/empty, the application reads the bundled `certs/prod-ca-2021.crt`; next.config.ts explicitly traces this fallback into server artifacts. Invalid configured PEM fails closed instead of falling back. Use the CA provided by Supabase for the selected project's chain if changing projects.

Local read-only verification of the actual Prisma initialization:
```powershell
$env:NODE_ENV = "production"
Remove-Item Env:NODE_EXTRA_CA_CERTS -ErrorAction SilentlyContinue
npm run db:verify:runtime
Remove-Item Env:NODE_ENV
```
This checks the restricted database identity and executes `prisma.user.findUnique()` without printing account data or changing records. On 2026-10-24 it passed against hosted Supabase using both bundled CA and environment PEM with startup CA trust unset. These are production-mode local checks. On 2026-10-26 the user separately confirmed successful deployed login/application use. Trusted migration/provisioning scripts still use their documented workstation CA configuration.

In Supabase Auth, keep signup disabled and the Send Email hook active. Set Site URL to the final HTTPS origin and narrow allowed redirects to intended origins. Email/password is the only implemented flow; no invitations/recovery calls are needed.

## Publish only after configuration review

The repository has origin https://github.com/acidstorme/AuthorsSupportPortal.git. Review local changes/commit selection first; no push is performed by this handoff. Import the intended branch in Vercel or link with the installed CLI after account/team selection. Do not copy a deployment token into chat.

Manual CLI outline (not executed):
```powershell
vercel login
vercel link
# Configure Production variables privately in the selected project's dashboard.
# Review project link, environment, final APP_URL and Supabase target before publication.
vercel --prod
```
Git-based deployment can use the same config. A Vercel deployment success alone does not prove Auth/DB/AI correctness. For previews, use a deliberately isolated test project/origin or leave integration credentials unset; the public shell can build while protected actions correctly report configuration errors. Do not weaken Origin checks to accept arbitrary preview domains.

## Required live acceptance

1. Record final URL, source revision, Vercel Node version and function region; verify certificate trust/runtime role through actual protected requests.
2. In separate browsers, sign in as a demo author and admin; verify HTTPS HTTP-only/SameSite cookies and author isolation.
3. Create a labelled ticket, check category/priority, admin draft cache/provenance, manual edits and explicit send; verify the author sees the reply without refreshing.
4. Verify date-range/oldest-unresolved controls, private-note isolation, RESOLVED reply attention, CLOSED denial and explicit reopening.
5. Confirm reviewed function deadlines, absence of raw errors/secrets, no mail/provisioning operations in web runtime, and intended reviewer access.
6. Keep README/TESTING synchronized with the live URL and actual results. User-confirmed deployment/login is recorded; record the final complete deployed walkthrough separately when performed.

Rollback uses a previously reviewed Vercel deployment. Database migrations are separate and are not automatically rolled back; never reset the hosted database as a web rollback mechanism.
