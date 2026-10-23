# REST API

## Status

Implemented: authentication, current user, admin-access overview, scoped books and Milestone 3 author tickets/public messages. Milestone 2 hosted setup/sign-ins were verified by the user. Ticket tests include mocked handler/service/transaction boundaries and anonymous actual HTTP checks; see TESTING for hosted limitations. Admin management and AI endpoints remain planned.

All implemented handlers use the Node.js runtime. They validate/authorize and delegate to services/repositories. Cookie authentication is required; Bearer-only clients are not supported.

## Shared implemented contract

Success: `{data: ...}`, with optional top-level `meta` for lists. Error:
```json
{"error":{"code":"FORBIDDEN","message":"This operation is not available for your role.","requestId":"<request-uuid>"}}
```
Validation errors include `fieldErrors`. Provider errors, passwords, keys, JWTs, refresh tokens and complete database records are never serialized. API responses are private/no-store.

| Status | Meaning |
|---|---|
| 200 | Successful read/login |
| 204 | Logout complete, no body |
| 400 | Malformed JSON or wrong content type |
| 401 | Missing/expired session, invalid login |
| 403 | Role/origin denied, incomplete application mapping, author filter forbidden |
| 404 | Missing or invisible book |
| 413 | Request JSON exceeds 16 KiB |
| 422 | Invalid fields/enums/query/path or unknown JSON fields |
| 429 | Auth provider throttling |
| 503 | Integration/configuration unavailable; logout may report remote revocation failure |
| 405 | Unsupported method; framework-generated response |

Mutating endpoints require `Origin` equal to the configured APP_URL origin and reject cross-site fetch metadata. Login requires Content-Type application/json. Auth is verified with getUser(); application role is read by UUID from app.users, never Auth user metadata or caller fields.

## Implemented endpoints

### POST /api/auth/login
Public, same-origin only. Body:
```json
{"email":"priya.sharma@email.com","password":"Bookleaf123"}
```
Email is validated/lowercased; password is 1–200 characters; extra fields such as role are rejected. Success sets HTTP-only session cookies and returns:
```json
{"data":{"user":{"id":"<Auth UUID>","email":"priya.sharma@email.com","displayName":"Priya Sharma","role":"AUTHOR","authorId":"AUTH001"},"redirectTo":"/author"}}
```
Admins return role ADMIN, authorId null and redirectTo /admin. The response never contains a session/token. Unknown/unprovisioned Auth identities receive 403 and newly established local session cookies are cleared. Invalid credentials return generic 401; provider throttling 429; unavailable dependency/configuration 503.

### POST /api/auth/logout
Same-origin only; no body. Idempotent, including a client already signed out. Revokes the current refresh session when present and clears all matching local cookie chunks; returns 204. No DB role lookup is needed to sign out an unprovisioned identity. If remote revocation fails, local cookies are still cleared and 503 LOGOUT_REVOKE_FAILED is returned. Issued access JWTs can remain valid until expiry; this is not a global revocation endpoint.

### GET /api/me
Verified cookie session required. Returns the principal shown in the login example directly under data. 401 when unauthenticated, 403 for missing/inconsistent application mapping, 503 for dependency/configuration failure. It does not accept user IDs or role parameters.

### GET /api/admin/overview
ADMIN only. Returns `{data:{user:<principal>,message:"Administrative access verified. Ticket management arrives in a later milestone."}}`. Both configured admins have identical permissions. Authors get 403; anonymous requests get 401. This is an access-confirmation endpoint, not a ticket queue.

### GET /api/books
Owner-scoped for authors; admins may read all or filter by author.

| Query | Values/default |
|---|---|
| page | integer 1–100000, default 1 |
| pageSize | integer 1–100, default 20 |
| sort | title_asc default, or publication_date_desc (null dates last) |
| authorId | optional AUTH-style source ID; ADMIN only |

Unknown/invalid query fields return 422. An author supplying authorId gets 403, even for their own ID; author scope always comes from the principal. Stable ordering uses bookId as tie-breaker.
```json
{"data":[{"bookId":"BK001","authorId":"AUTH001","title":"Whispers of the Ganges","mrp":"399.00","publicationDate":"2023-06-20"}],"meta":{"page":1,"pageSize":20,"total":2}}
```
This shortened example omits remaining fields for readability; actual DTOs contain every supplied book field.

### GET /api/books/:bookId
Owner/admin only. Source ID path such as BK001, validated as BK plus three digits. The repository query includes author ownership before retrieval; invisible and missing books both return 404. Invalid ID syntax returns 422.

Complete response field names: bookId, authorId, title, isbn, genre, publicationDate, status, mrp, authorRoyaltyPerCopy, totalCopiesSold, totalRoyaltyEarned, royaltyPaid, royaltyPending, lastRoyaltyPayoutDate, printPartner, availableOn. Monetary values are decimal strings; date-only fields YYYY-MM-DD; nulls and platform order preserved.

## Protected pages

/login is shared. Successful authors go to /author; admins to /admin. Anonymous protected-page requests redirect to /login. Wrong-role page requests redirect to the user's own landing page. API authorization returns status codes rather than redirects. Unprovisioned identities are shown an access-denied login message.

## Implemented ticket API — Milestone 3

All ticket endpoints require verified session cookies. Mutations require same-origin Origin and application/json, with a 16 KiB JSON body limit. UUID paths/request IDs are validated; unknown body/query properties return 422. Anonymous requests return 401. Missing and inaccessible tickets both return 404. Unexpected dependency failures return sanitized 503 errors using the existing error envelope.

### GET /api/tickets
AUTHOR only (admin queue comes in Milestone 4). No authorId parameter; scope comes from the principal. Query: page (1–100000, default 1), pageSize (1–100, default 20), optional status (OPEN/IN_PROGRESS/RESOLVED/CLOSED), sort (created_desc default or updated_desc); UUID descending breaks timestamp ties. Returns `{data:[<ticket>],meta:{page,pageSize,total}}`. Admin receives 403. Invalid query receives 422.

### POST /api/tickets
AUTHOR only. Body example:
```json
{"subject":"Book availability question","description":"Please help me check this listing.","bookId":"BK001","requestId":"11111111-1111-4111-8111-111111111111"}
```
bookId is nullable/optional for account-level inquiries and must belong to the current author (otherwise 422 INVALID_BOOK). Subject: trimmed 1–200 characters; description: trimmed 1–8000. requestId: client UUID, unique per author. Returns 201 `{data:<ticket>}`; identical normalized retry returns 200 with the original ticket. Changed content with the same ID returns 409 IDEMPOTENCY_CONFLICT. Client must retain its ID for retries and generate a new one for a new submission. Admin receives 403.

Ticket DTO example (also used by detail/list):
```json
{"id":"22222222-2222-4222-8222-222222222222","bookId":"BK001","subject":"Book availability question","description":"Please help me check this listing.","status":"OPEN","category":null,"priority":null,"createdAt":"2026-10-23T12:00:00.000Z","updatedAt":"2026-10-23T12:00:00.000Z"}
```
Category/priority are effective manual-over-AI values, otherwise null. No notes, draft text, internal errors or private audit metadata appear. Classification is not implemented yet; creation does not call AI. Description is stored on the ticket, not duplicated as a first reply.

### GET /api/tickets/:ticketId
Owner or ADMIN, public DTO under data; validates UUID, returns 422 for malformed IDs. Author pages: /author/tickets/new and /author/tickets/:ticketId. Page APIs perform the ownership checks independently of page guards.

### GET /api/tickets/:ticketId/messages
Owner or ADMIN. Query page/pageSize as above, chronological ascending with UUID tie-breaker. Returns:
```json
{"data":[{"id":"33333333-3333-4333-8333-333333333333","body":"Thank you for the update.","sender":{"displayName":"Priya Sharma","role":"AUTHOR"},"createdAt":"2026-10-23T12:01:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1}}
```
Only public messages are queried; no private notes or sender login emails/IDs are serialized. CLOSED remains readable. Lists/counts are bounded and polled without caching; conversation/detail every 5 seconds while active, ticket list every 10 seconds. Later conversation pages contain newer replies.

### POST /api/tickets/:ticketId/messages
Owner or ADMIN. Body: `{"body":"Thank you for the update.","requestId":"11111111-1111-4111-8111-111111111111"}`. Body is trimmed 1–8000 characters. Sender comes from the verified principal; supplied sender IDs are rejected. Returns 201 `{data:<message>}` or 200 for a matching committed retry. Retry IDs are unique per ticket/sender; different content returns 409 IDEMPOTENCY_CONFLICT.

New replies to CLOSED return 409 TICKET_CLOSED for both roles. An already committed matching reply may be retrieved by retry after closure without creating another message. OPEN/IN_PROGRESS/RESOLVED replies preserve status; author replies to RESOLVED set the attention timestamp for the future admin interface. Ticket lock, ownership/status recheck, message, updated timestamp and event are one transaction.

## Planned admin/AI ticket API — not implemented

| Method/path | Access and intended behavior |
|---|---|
| PATCH /api/tickets/:id | ADMIN; explicit status/manual category/priority |
| PUT/DELETE /api/tickets/:id/assignment | ADMIN; self-assignment or clear |
| GET/POST /api/tickets/:id/notes | ADMIN only; private notes |
| GET /api/tickets/:id/events | ADMIN only; audit history |
| POST /api/tickets/:id/classification | ADMIN; bounded explicit retry |
| POST /api/tickets/:id/draft | ADMIN; valid cache or generation; optional explicit regeneration |
| PATCH /api/tickets/:id/attention | ADMIN; acknowledge observed resolved-author reply |

Future create bodies never accept role/author/sender identity. Manual values override AI independently; neither means awaiting triage. Status/message rules, idempotency, private-note isolation and grounded AI review remain unchanged. Detailed ticket contracts will be synchronized with implementation in later milestones. No attachments/linking endpoints exist.
