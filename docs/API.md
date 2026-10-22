# REST API

## Status

**No `/api/...` endpoints are implemented in Milestone 1.** Requests to the paths below currently return Next.js 404 behavior, not this planned API envelope. This document specifies the agreed contract to implement in later milestones. All business handlers will use Node.js runtime and remain thin.

## Common contract (planned)

Authentication: same-origin Supabase session cookies. Backend verifies the identity, then loads its application role. No caller-supplied role, sender ID or author ID for creation. Mutation requests require JSON and valid same-origin headers. No unrestricted CORS.

Headers: `Content-Type: application/json`; ticket creation and public-message creation also require `Idempotency-Key: <UUID>`. Repeating a key with the same body returns the original record; changing the body for that key returns 409.

Example success:

```json
{"data":{"id":"<ticket-uuid>","status":"OPEN","category":null,"priority":null,"aiStatus":"FAILED"}}
```

Example error:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","fieldErrors":{"subject":["Required"]},"requestId":"<request-uuid>"}}
```

| Status | Meaning |
|---|---|
| 200 | Successful read/update or replay of an existing idempotent creation |
| 201 | Created ticket/message/note |
| 204 | Logout/assignment removal success; no response body |
| 400 | Malformed JSON, path, query or idempotency header |
| 401 | No valid session or invalid login |
| 403 | Role denied or invalid mutation origin |
| 404 | Resource missing or invisible to this author |
| 409 | CLOSED reply, conflicting replay, or conflicting critical mutation |
| 422 | Valid JSON with invalid fields/ownership selection |
| 429 | AI retry/regeneration cooldown or login throttling |
| 503 | Dependency unavailable; no provider internals returned |

List queries use `page=1&pageSize=20` (max 100). Responses include `meta: {page,pageSize,total}`. Message/note/event history uses an opaque `(createdAt,id)` cursor with `limit=50` (max 100) and `meta.nextCursor`. Sorts use an allowlist and ID tie-breaker. Dates are ISO date/date-time strings, money decimal strings; enums use Prisma/API identifiers with exact category labels supplied separately by shared constants.

Author queries always enforce ownership. Wrong-owner objects return 404, including nested messages. Invalid cross-author book selection in ticket creation returns a generic 422 without disclosing the other book's details.

## Endpoint specification (all planned)

| Method and actual path | Access | Parameters/body and result | Specific errors |
|---|---|---|---|
| POST `/api/auth/login` | Public | `{email,password}`; set session cookies; `200 {data:{role,redirectTo}}` | 401 generic invalid login; 422 fields; 503 Auth unavailable |
| POST `/api/auth/logout` | Signed in | No body; clear session; 204 | 401 session |
| GET `/api/me` | Both | No parameters; verified user ID, role, display name, own author profile when applicable | 401; 403 unprovisioned identity |
| GET `/api/books` | Both | Pagination; admin-only optional `authorId`; `sort=title_asc|publication_date_desc`; list book DTOs | 400 query; 403 author using admin-only filter |
| GET `/api/books/:bookId` | Owner/admin | Source ID such as BK001; complete permitted source book fields | 404 invisible/missing |
| GET `/api/tickets` | Both | Pagination; `status,category,priority,createdFrom,createdTo,awaitingTriage`; admin-only `authorId,assignedToMe,needsAttention`; `sort=urgency_age|created_asc|created_desc|updated_desc` | 400 query/date range; 403 admin-only filters |
| POST `/api/tickets` | Author | `{bookId:null|"BK001",subject,description}` plus idempotency header; 201 ticket after bounded classification | 403 admin; 422 validation/book; 409 replay conflict |
| GET `/api/tickets/:id` | Owner/admin | UUID; role-specific ticket DTO with effective category/priority and original query; public messages fetched separately | 404 invisible/missing |
| PATCH `/api/tickets/:id` | Admin | Any nonempty subset of `{status,manualCategory,manualPriority}`; null clears each override; 200 updated ticket | 403 role; 422 enum/body |
| PUT `/api/tickets/:id/assignment` | Admin | No sender/admin ID body; assign to authenticated admin; 200 updated assignment | 403 role; 404 ticket |
| DELETE `/api/tickets/:id/assignment` | Admin | No body; clear assignment; 204 | 403 role; 404 ticket |
| GET `/api/tickets/:id/messages` | Owner/admin | Cursor/limit; public message DTOs only | 404 invisible/missing |
| POST `/api/tickets/:id/messages` | Owner/admin | `{body}` and idempotency header; sender derived; 201 public message | 409 CLOSED/replay conflict; 422 text |
| GET `/api/tickets/:id/notes` | Admin | Cursor/limit; private notes | 403 role; 404 ticket |
| POST `/api/tickets/:id/notes` | Admin | `{body}`; 201 private note; CLOSED does not prevent notes | 403 role; 422 text |
| GET `/api/tickets/:id/events` | Admin | Cursor/limit; safe event type/actor/metadata | 403 role; 404 ticket |
| POST `/api/tickets/:id/classification` | Admin | No body; explicit bounded retry; 200 AI status/results; never changes manual values | 409 active attempt; 429 cooldown; 503 failed retry with persisted state |
| POST `/api/tickets/:id/draft` | Admin | `{regenerate:false}` default; return valid cache or generate; true explicitly requests regeneration; 200 `{text,provider,generatedAt,contextHash,cached}` | 409 in-flight/context race; 429 cooldown; 503 provider failure |
| PATCH `/api/tickets/:id/attention` | Admin | `{observedReplyAt:"<ISO timestamp>"}`; acknowledge only that observed resolved-author reply; 200 attention state | 422 timestamp; newer reply remains flagged |

Ticket PATCH has no generic version field. Concurrent critical operations serialize narrowly; future implementation tests determine any necessary additional compare-and-set guards, not a broad optimistic-version framework.

### Example ticket request

```http
POST /api/tickets
Content-Type: application/json
Idempotency-Key: 00000000-0000-4000-8000-000000000001

{"bookId":"BK001","subject":"Royalty question","description":"Could you explain the pending royalty snapshot for this book?"}
```

No `authorId`, `role` or `senderId` accepted. Subject: trimmed 1-200 characters. Description/message/note: trimmed 1-10,000 characters. Unknown security-sensitive fields rejected. General account tickets use `bookId:null`.

Creation returns 201 once saved even if classification fails; `aiStatus` communicates that outcome. A client that loses the response reuses the same idempotency key. No attachment IDs or file bytes are accepted in the core API.

### Example book response

```json
{"data":{"bookId":"BK001","authorId":"AUTH001","title":"Whispers of the Ganges","mrp":"399.00","royaltyPending":"3570.00","publicationDate":"2023-06-20","availableOn":["Amazon India","Flipkart","BookLeaf Store"]}}
```

This is a shortened illustrative example; actual book DTOs will include every supplied book field. Null fields stay null, not zero or invented dates.

### Visibility and lifecycle

Author DTOs never include private notes, cached drafts, internal event metadata or raw AI error details. AI drafts are not messages. Admins must explicitly POST edited final text to the public-message endpoint. Assignment/messages do not change status. RESOLVED replies stay resolved; CLOSED public replies return 409 for both roles. Admins explicitly reopen through ticket PATCH.
