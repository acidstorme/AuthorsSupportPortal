# Authentication and authorization foundation

`supabase.ts` creates a cookie-aware server client for future Route Handlers. The browser factory is in `src/features/auth/`. Neither is currently invoked by the scaffold page.

Milestone 2 adds login/logout, verified identity (`getUser()`), application role lookup by Auth UUID, role/ownership helpers and the session-refresh proxy. These checks must execute on the backend. A valid Auth user without a provisioned `app.users` record has no application access.

Do not treat Supabase user metadata as application authorization. Do not expose Admin API credentials to the browser or deploy provisioning credentials to the web application.
