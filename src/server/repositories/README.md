# Database repositories

M2 implements explicit user-identity selection and scoped read-only book queries. Ticket queries remain deferred.

Repositories use the server-only lazy Prisma client. Author queries must include their author scope in the query, including nested resources. Raw SQL must be parameterized. Return selected fields for explicit DTO mapping rather than exposing complete Prisma records.
