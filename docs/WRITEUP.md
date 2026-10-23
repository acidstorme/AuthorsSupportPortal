# BookLeaf Portal — Approach and Trade-offs

**Milestone 2 draft; final submission will reflect completed, verified behavior.**

The portal is designed as a Next.js modular monolith with separate HTTP, authentication, business-service, repository and AI boundaries. Supabase provides email/password identity and PostgreSQL; Prisma manages the application schema. A single application and hosted-only local integration keep setup practical within four days.

The source import preserves ten authors and eighteen books, including production nulls and platform arrays. Application users share Supabase Auth UUIDs; profiles retain original business IDs and contacts. The approved isolated demo uses exact source emails and two admins, with privileged setup gated by project approval and outbound-mail blocking. A composite foreign key protects ticket/book ownership; messages, private notes and events have separate tables.

Milestone 2 implements server-verified authentication, HTTP-only sessions, role guards, scoped book reads and restartable provisioning/import tools. The next priority is the ticket flow. Planned AI classification runs after persistence and preserves manual overrides. Grounded drafts will be cached and editable, with explicit sending and no unsupported operational claims.

Polling and a small fixed Knowledge Base avoid unnecessary infrastructure. Attachments and ticket links are deferred; future attachments will use private Cloudflare R2 storage. Production evolution would add durable asynchronous processing when measured demand justifies it, stronger operational monitoring and broader security/reliability testing.

Local tests cover policies, mocked HTTP/auth flows, provisioning recovery and source integrity. Hosted setup and live sign-ins remain safety-gated. AI quality and deployment are later verification work.
