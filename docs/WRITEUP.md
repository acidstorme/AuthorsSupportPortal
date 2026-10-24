# BookLeaf Portal — Approach and Trade-offs

**Milestone 5 draft; final submission will reflect completed, verified behavior.**

The portal is designed as a Next.js modular monolith with separate HTTP, authentication, business-service, repository and AI boundaries. Supabase provides email/password identity and PostgreSQL; Prisma manages the application schema. A single application and hosted-only local integration keep setup practical within four days.

The source import preserves ten authors and eighteen books, including production nulls and platform arrays. Application users share Supabase Auth UUIDs; profiles retain original business IDs and contacts. The approved isolated demo uses exact source emails and two admins, with privileged setup gated by project approval and outbound-mail blocking. A composite foreign key protects ticket/book ownership; messages, private notes and events have separate tables.

The implementation includes verified authentication, scoped books, provisioning, ticket conversations and admin lifecycle/private history. Validation, retry IDs and shared locks protect ownership, closing and replies. AI classification runs after persistence with a deadline and cannot overwrite manual decisions. Grounded drafts use selected fixed policies and bounded public context, with a persisted fingerprint cache. Admins edit and explicitly send; AI failure leaves manual support available.

Polling and a small fixed Knowledge Base avoid unnecessary infrastructure. Attachments and ticket links are deferred; future attachments will use private Cloudflare R2 storage. Production evolution would add durable asynchronous processing when measured demand justifies it, stronger operational monitoring and broader security/reliability testing.

Tests cover policies, handlers, retries, lifecycle, source integrity and AI failure/cache behavior. Hosted safety and a real synthetic OpenAI smoke passed; exact integration results and limits are documented separately. Deployment, broad model evaluation and final rendered-page validation remain delivery work.
