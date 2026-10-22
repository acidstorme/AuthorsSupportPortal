# Database repositories

Reserved boundary; no ticket queries are implemented in Milestone 1.

Repositories use the server-only lazy Prisma client. Author queries must include their author scope in the query, including nested resources. Raw SQL must be parameterized. Return selected fields for explicit DTO mapping rather than exposing complete Prisma records.
