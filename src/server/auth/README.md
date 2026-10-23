# Authentication and authorization foundation

`supabase.ts` creates cookie-aware server-only clients. HTTP-only cookies are managed by Route Handlers and the refresh proxy; browser components use REST and have no Auth SDK/token storage.

Milestone 2 implements login/logout, verified identity (`getUser()`), application role lookup by Auth UUID, role/ownership helpers and session-refresh proxy. A valid Auth user without a complete application mapping has no access. Hosted verification is pending safety/configuration prerequisites.

Do not treat Supabase user metadata as application authorization. Do not expose Admin API credentials to the browser or deploy provisioning credentials to the web application.
