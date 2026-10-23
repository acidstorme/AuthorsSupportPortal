# Database repositories

Repositories implement identity selection, scoped books, author tickets/messages and admin queue/mutations/private history. Status and reply transactions use the same ticket row lock. Effective manual-over-AI filters/sorts use parameterized SQL; note retries use the existing note UUID. Mutations and events commit atomically; no-ops generate no events. Public DTOs omit private notes and AI draft/error fields. AI remains future work.

Repositories use the server-only lazy Prisma client. Author queries must include their author scope in the query, including nested resources. Raw SQL must be parameterized. Return selected fields for explicit DTO mapping rather than exposing complete Prisma records.
