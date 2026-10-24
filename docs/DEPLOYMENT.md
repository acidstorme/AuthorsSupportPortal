# Vercel deployment handoff

Status: Vercel selected. The user requested local delivery review before selecting the demo Supabase project. No Vercel project has been linked/created, credentials uploaded, deployment published or production URL claimed. Configuration below is prepared; actual platform execution remains unverified.

## Files and build

- vercel.json selects Next.js, the previously tested npm 11.21.1 clean install, and npm run build. Build generates Prisma but never runs migrations, provisioning or seed.
- .vercelignore excludes local environment files, setup/test scripts, data and documentation from CLI source upload. Privileged setup code is not needed by runtime functions. No secrets belong in vercel.json or Git.
- next.config.ts traces public certs/*.crt into server function artifacts. Local build trace verification confirmed the CA in the login function. Existing Node Route Handlers keep maxDuration=60 for ticket creation/classification/drafting. The [Vercel duration guide](https://vercel.com/docs/functions/configuring-functions/duration) supports per-route maxDuration; confirm the selected account's limits before publication.
- Choose Node.js **22.x** in Vercel Project Settings (tested locally: 22.17.0); Node 24 is permitted by engines but unverified. Keep the root directory at the repository root. Region should be close to the selected Supabase project; no region is guessed in config.

## Decisions needed after local review

1. Vercel account/team and project name; final stable HTTPS production origin.
2. A separate isolated Supabase demo project (preferred), or explicit approval to reuse the current isolated assignment project. Never silently publish the development database.
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
| AI_MODE | openai or explicitly labelled mock |
| OPENAI_MODEL | Approved available model; required for intended real-mode choice |
| OPENAI_API_KEY | Private server-side API key, required only for openai mode |

Do **not** upload DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_* passwords/acknowledgements or provisioning credentials to the web runtime. They are only for a trusted setup workstation. Do not use a postgres owner connection as DATABASE_URL. Never use NEXT_PUBLIC_ for privileged keys.

For CA trust, a deployment candidate is adding `&sslrootcert=certs%2Fprod-ca-2021.crt` to DATABASE_URL, referencing the traced public CA relative to runtime working directory. This exact relative-file pattern was tested locally with NODE_EXTRA_CA_CERTS unset and restricted_identity=true. A Windows absolute certificate path is invalid in Linux functions. The file must belong to the selected Supabase project's trusted chain. Its final Vercel artifact path/connectivity **must still be verified on the actual deployment**. Keep sslmode=verify-full; never set rejectUnauthorized:false or NODE_TLS_REJECT_UNAUTHORIZED=0. NODE_EXTRA_CA_CERTS is read at process startup; do not assume a local Windows shell path will work on Vercel.

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
6. Add the verified live URL and actual deployment results to README/TESTING. Until then, mark deployment pending.

Rollback uses a previously reviewed Vercel deployment. Database migrations are separate and are not automatically rolled back; never reset the hosted database as a web rollback mechanism.
