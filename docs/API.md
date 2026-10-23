# REST API

## Status

Implemented in Milestone 2: authentication, current user, admin-access overview and read-only books. The implementation is covered by mocked handler/service tests; live hosted verification is pending safety/configuration checks. All ticket endpoints remain planned and currently return Next.js 404 behavior.

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

## Planned ticket API — not implemented

| Method/path | Access and intended behavior |
|---|---|
| GET /api/tickets | Scoped pagination/filtering/sorting |
| POST /api/tickets | AUTHOR; owned nullable book, subject, description; idempotency key |
| GET /api/tickets/:id | Owner/admin; role-specific DTO |
| PATCH /api/tickets/:id | ADMIN; explicit status/manual category/priority |
| PUT/DELETE /api/tickets/:id/assignment | ADMIN; self-assignment or clear |
| GET/POST /api/tickets/:id/messages | Owner/admin; public conversation; reject CLOSED replies |
| GET/POST /api/tickets/:id/notes | ADMIN only; private notes |
| GET /api/tickets/:id/events | ADMIN only; audit history |
| POST /api/tickets/:id/classification | ADMIN; bounded explicit retry |
| POST /api/tickets/:id/draft | ADMIN; valid cache or generation; optional explicit regeneration |
| PATCH /api/tickets/:id/attention | ADMIN; acknowledge observed resolved-author reply |

Future create bodies never accept role/author/sender identity. Manual values override AI independently; neither means awaiting triage. Status/message rules, idempotency, private-note isolation and grounded AI review remain unchanged. Detailed ticket contracts will be synchronized with implementation in later milestones. No attachments/linking endpoints exist.
