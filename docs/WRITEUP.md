# BookLeaf Portal — Approach and Trade-offs

**Milestone 1 draft; final submission will reflect completed, verified behavior.**

The portal is designed as a Next.js modular monolith with separate HTTP, authentication, business-service, repository and AI boundaries. Supabase provides email/password identity and PostgreSQL; Prisma manages the application schema. A single application and hosted-only local integration keep setup practical within four days.

The foundation preserves the supplied ten authors and eighteen books exactly, including production nulls and distribution arrays. Application users share Supabase Auth UUIDs, while author profiles retain the original author IDs and contact details. Synthetic login aliases avoid using potentially real contact addresses. A composite foreign key protects ticket/book ownership; public messages, private notes and audit events remain separate.

The next priorities are verified authentication, safe idempotent provisioning, exact database seeding and the complete author/admin ticket flow. Planned AI classification will run after ticket persistence, use structured outputs and preserve manual overrides. Grounded response drafts will be cached and editable, with explicit admin sending. Unsupported payment confirmations, escalations and operational claims will be excluded.

Polling and a small fixed Knowledge Base avoid unnecessary infrastructure. Attachments and ticket links are deferred; future attachments will use private Cloudflare R2 storage. Production evolution would add durable asynchronous processing when measured demand justifies it, stronger operational monitoring and broader security/reliability testing.

Milestone 1 verification covers types, build, configuration tests and source integrity. Hosted database/Auth setup, end-to-end behavior, AI quality and deployment remain unverified until their milestones are completed.
