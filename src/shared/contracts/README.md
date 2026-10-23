# Shared transport contracts

tickets.ts defines explicit public ticket/message transport DTOs consumed by server serializers and browser clients. Private notes, drafts and internal AI errors are omitted. Do not import Prisma models, server secrets or server integrations into browser code. Database enums have API identifiers and exact user-facing labels documented in the architecture plan.
