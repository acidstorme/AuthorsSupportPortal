# BookLeaf Portal — Approach and Trade-offs

**Milestone 3 draft; final submission will reflect completed, verified behavior.**

The portal is designed as a Next.js modular monolith with separate HTTP, authentication, business-service, repository and AI boundaries. Supabase provides email/password identity and PostgreSQL; Prisma manages the application schema. A single application and hosted-only local integration keep setup practical within four days.

The source import preserves ten authors and eighteen books, including production nulls and platform arrays. Application users share Supabase Auth UUIDs; profiles retain original business IDs and contacts. The approved isolated demo uses exact source emails and two admins, with privileged setup gated by project approval and outbound-mail blocking. A composite foreign key protects ticket/book ownership; messages, private notes and events have separate tables.

The implementation includes server-verified authentication, HTTP-only sessions, scoped book reads, restartable provisioning and author ticket conversations. Strict validation, ownership checks, unique request IDs, transactional events and brief reply locks protect data and retries. Admin management is next. Planned AI classification runs after persistence and preserves manual overrides; grounded drafts will be cached, editable and explicitly sent.

Polling and a small fixed Knowledge Base avoid unnecessary infrastructure. Attachments and ticket links are deferred; future attachments will use private Cloudflare R2 storage. Production evolution would add durable asynchronous processing when measured demand justifies it, stronger operational monitoring and broader security/reliability testing.

Tests cover policies, HTTP handlers, ownership, retries, lifecycle safeguards, provisioning recovery and source integrity. The user verified hosted setup and live sign-ins. AI quality and deployment remain later verification work; current test results and gaps are recorded separately.
