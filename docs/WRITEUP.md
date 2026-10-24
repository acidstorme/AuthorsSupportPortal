# BookLeaf Portal - Approach and Trade-offs

**Local delivery version. Live deployment awaits project selection and review.**

The portal is designed as a Next.js modular monolith with separate HTTP, authentication, business-service, repository and AI boundaries. Supabase provides email/password identity and PostgreSQL; Prisma manages the application schema. A single application and hosted-only local integration keep setup practical within four days.

The source import preserves ten authors and eighteen books, including production nulls and platform arrays. Application users share Supabase Auth UUIDs; profiles retain original business IDs and contacts. The approved isolated demo uses exact source emails and two admins, with privileged setup gated by project approval and outbound-mail blocking. A composite foreign key protects ticket/book ownership; messages, private notes and events have separate tables.

The implementation includes HTTP-only authentication, scoped books, provisioning, ticket conversations and admin lifecycle/private history. Queue date filters and oldest-unresolved controls support triage. Validation, retry IDs and shared locks protect ownership, closing and replies. AI classification runs after persistence with a deadline and cannot overwrite manual decisions. Drafts use selected fixed policies and bounded public context, with a persisted fingerprint cache. Prompts prohibit unsupported operational claims; admins review, edit and explicitly send. AI failure leaves manual support available.

Polling and a small fixed Knowledge Base avoid unnecessary infrastructure. Attachments and ticket links are deferred; future attachments will use private Cloudflare R2 storage. Production evolution would add durable asynchronous processing when measured demand justifies it, stronger operational monitoring and broader security/reliability testing.

Tests cover policies, handlers, retries, lifecycle, source integrity and AI failure/cache behavior. Hosted safety, admin/AI workflows, a focused editor browser regression and a real synthetic OpenAI smoke passed. Exact delivery results and limits are documented separately. Broad adversarial model evaluation, larger-scale operations and live Vercel deployment remain explicit follow-up work.
