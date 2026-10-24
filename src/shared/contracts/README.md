# Shared transport contracts

tickets.ts defines explicit public ticket/message transport DTOs consumed by server serializers and browser clients. Private notes, drafts and internal AI errors are omitted. Do not import Prisma models, server secrets or server integrations into browser code. Database enums have API identifiers and exact user-facing labels documented in the architecture plan.

admin-tickets.ts defines separate ADMIN-only ticket management, note and audit DTOs. These are never used to serialize author responses. The server independently checks roles before returning private history.

ai.ts defines the ADMIN-only draft DTO with provider/model, stable completion timestamp and cached/stale flags. Admin triage also exposes sanitized classification error/provenance fields. Keys, full prompts and raw provider errors never become transport fields.
