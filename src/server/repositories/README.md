# Database repositories

Repositories implement identity selection, scoped books, author ticket lists/creation and public messages. Ticket creation and message writes include audit events transactionally; reply transactions lock the ticket and recheck owner/status before inserting. No note or AI draft fields are exposed through public DTOs. Admin mutation repositories remain future work.

Repositories use the server-only lazy Prisma client. Author queries must include their author scope in the query, including nested resources. Raw SQL must be parameterized. Return selected fields for explicit DTO mapping rather than exposing complete Prisma records.
