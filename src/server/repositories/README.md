# Database repositories

Repositories implement identity/books, author/admin ticket operations and AI context/claims/completion. Status/reply transactions share a row lock. AI context is scoped/bounded public data; claims use existing timestamps with thirty-second cooldown and stale-completion guards. AI-only updates never include manual fields. Public DTOs omit private notes/drafts/errors; admin triage exposes only sanitized classification errors. No provider request runs inside a transaction.

Repositories use the server-only lazy Prisma client. Author queries must include their author scope in the query, including nested resources. Raw SQL must be parameterized. Return selected fields for explicit DTO mapping rather than exposing complete Prisma records.
