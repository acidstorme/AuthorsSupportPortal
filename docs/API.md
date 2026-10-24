# REST API

## Status

Implemented: authentication, scoped books, author/admin tickets, lifecycle/private history and Milestone 5 classification/draft endpoints. Milestones 2–4 were reviewed by the user. Tests distinguish mocked boundaries, hosted HTTP and live-provider checks; see TESTING for exact results and remaining gaps.

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
| 40 | Missing or invisible book |
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
ADMIN only. Returns `{data:{user:<principal>,message:"Administrative access verified. Ticket management is available at /admin."}}`. Both configured admins have identical permissions. Authors get 403; anonymous requests get 401. Queue data is at /api/admin/tickets.

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
Category/priority are effective manual-over-AI values, otherwise null. No notes, draft text, internal errors or private audit metadata appear. New creation persists first, then awaits one bounded classification attempt; AI failure does not fail creation. The response is the original persisted DTO, so detail/list requests reveal the latest AI/manual values. Matching creation retries do not run AI again. Description is stored on the ticket, not duplicated as a first reply.

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

New replies to CLOSED return 409 TICKET_CLOSED for both roles. An already committed matching reply may be retrieved by retry after closure without creating another message. OPEN/IN_PROGRESS/RESOLVED replies preserve status; author replies to RESOLVED set the attention timestamp for the admin interface. Ticket lock, ownership/status recheck, message, updated timestamp and event are one transaction.

## Admin ticket API — implemented in Milestone 4

Every endpoint in this section is ADMIN only: anonymous 401, AUTHOR 403 before database access. UUID syntax errors/invalid query or JSON fields return 422; missing ticket 404. Standard envelopes, same-origin mutation checks, JSON body/size limits and private/no-store caching apply. Both admins can manage all tickets, regardless of assignment. Opening/polling a ticket does not acknowledge author replies or change ticket state.

### GET /api/admin/tickets

Query: page/pageSize (same bounds/defaults as author lists); optional status/category/priority using enum identifiers; assignment=all (default), mine or unassigned; attention=all (default) or unseen; sort=created_desc (default), updated_desc or priority_desc; optional search (trimmed, max 200 characters). Search matches literal case-insensitive subject, author name or original author ID. Priority/category filters and priority sorting use manual-over-AI values. Priority order is CRITICAL, HIGH, MEDIUM, LOW, then unclassified; date descending and UUID descending break ties. Other sorts use descending date and UUID. SQL values are parameterized; no supplied SQL/sort expression is executed.

Returns `{data:[<adminTicket>],meta:{page,pageSize,total}}`. Empty results are 200. Queue polling is every ten seconds while active.

### GET /api/admin/tickets/:ticketId

Returns `{data:<adminTicket>}`. Public ticket fields plus:
```json
{"author":{"authorId":"AUTH001","name":"Priya Sharma","email":"priya.sharma@email.com"},"book":null,"assignedTo":null,"manualCategory":null,"manualPriority":"HIGH","aiCategory":null,"aiPriority":null,"aiStatus":"PENDING","needsAttention":true,"resolvedAuthorReplyAt":"2026-10-24T00:00:00.000Z"}
```
Example shows only additional fields. Milestone 5 also returns aiProvider (MOCK/OPENAI/null), aiModel and sanitized aiErrorCode for admin triage. No draft text, raw provider errors or note bodies are included. Private history/drafts are fetched separately. needsAttention compares the last author reply sent while RESOLVED with the shared acknowledged timestamp. The marker remains until explicit acknowledgement, including across reopening/other status changes. Detail polls every five seconds while active. Admin detail page: /admin/tickets/:ticketId.

### PATCH /api/tickets/:ticketId

Body has one or more of status, manualCategory, manualPriority. Example: `{"status":"IN_PROGRESS","manualCategory":"GENERAL_INQUIRY","manualPriority":"HIGH"}`. Category/priority permit null to clear the override; missing keys are unchanged. Extra keys, AI values, empty object or invalid enums are rejected. Returns 200 `{data:<adminTicket>}`. Changes update only specified columns; AI fields are untouched. Each effective status/manual-field change records an event; repeated no-op updates do not.

All four statuses are valid explicit destinations. Select OPEN to reopen RESOLVED/CLOSED. No messages, notes or assignment implicitly change status. Status and message insertion serialize with the same short ticket row lock; closed replies cannot slip past a committed close.

### PUT /api/tickets/:ticketId/assignment

JSON body `{}` required; derives assignee from the verified ADMIN. Supplied assignee IDs are rejected. Another admin may take ownership of an assigned ticket. Returns 200 `{data:<adminTicket>}`; does not change status. Same assignment is a no-op.

### DELETE /api/tickets/:ticketId/assignment

No body; clears assignment and returns 200 `{data:<adminTicket>}`. Already unassigned is a no-op; does not change status. Any admin may unassign.

### GET /api/tickets/:ticketId/notes

Query page/pageSize as above. Newest first, UUID descending tie-breaker. Returns:
```json
{"data":[{"id":"33333333-3333-4333-8333-333333333333","body":"Private support context.","creator":{"displayName":"Admin"},"createdAt":"2026-10-24T00:00:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1}}
```
Only admins receive note bodies. Notes are never public messages. Notes are readable/addable on CLOSED tickets because the closed policy restricts public replies.

### POST /api/tickets/:ticketId/notes

Body: `{"body":"Private support context.","requestId":"33333333-3333-4333-8333-333333333333"}`. Trimmed body 1–8000 characters, UUID request ID required. Returns 201 `{data:<adminTicket>}` after recording the note/event. This response refreshes ticket management data; fetch notes to retrieve the note DTO. requestId becomes the note UUID, enabling matching ticket/creator/content retries without duplicate notes/events; retries also return 201. A used ID with different content/owner/ticket returns 409 IDEMPOTENCY_CONFLICT. New submissions need new IDs. Note creation does not change status.

### GET /api/tickets/:ticketId/events

Query page/pageSize as above, newest first with UUID tie-breaker. Returns `{data:[{id,type,actor:{displayName}|null,metadata,createdAt}],meta:{page,pageSize,total}}`. Actor null means a system event. Mutation/event writes are atomic. Metadata records changed values or message/note IDs, never note bodies. All history is admin-only; authors cannot infer private notes through an events endpoint.

### POST /api/tickets/:ticketId/acknowledge

Body: `{"observedReplyAt":"2026-10-24T00:00:00.000Z"}` copied from the admin detail's resolvedAuthorReplyAt. Returns 200 `{data:<adminTicket>}` and records AUTHOR_REPLY_ACKNOWLEDGED when needed. If no matching author reply exists or a newer reply has arrived, returns 409 ATTENTION_CHANGED; refresh/review before retrying. Lock and timestamp comparison prevent acknowledging an unseen concurrent reply. Matching repeated acknowledgement is a no-op. Acknowledgement is shared between admins and never changes status.

## AI API — implemented in Milestone 5

Both endpoints require ADMIN, same-origin JSON and a valid UUID path. Anonymous 401, AUTHOR 403, malformed request/extra keys 422, missing ticket 404. They use the Node runtime with maxDuration=60; provider deadlines are shorter, but host execution limits must still be checked at deployment. AI work is awaited; there is no detached serverless background task. No attachments/linking endpoints exist.

### POST /api/tickets/:ticketId/classification

Body `{}`. Explicit classification/retry based on the original subject/description. Returns 200:
```json
{"data":{"status":"SUCCEEDED","provider":"MOCK","model":"deterministic-v1","category":"ROYALTY_PAYMENTS","priority":"CRITICAL"}}
```
Updates only AI fields, provenance/status and a corresponding event. Manual overrides are preserved independently. Each attempt uses a conditional timestamp claim; running/recent work returns 429 AI_COOLDOWN (retry after thirty seconds from the prior attempt). Stale completion returns 409 AI_STALE. Provider/refusal/timeout/invalid output or bad AI configuration returns sanitized 503 AI_UNAVAILABLE; when possible an AI_CLASSIFICATION_FAILED event/status is persisted. Existing successful AI values are retained on failure, and the ticket remains manually manageable. New ticket creation invokes this service after persistence without requiring ADMIN, under the creation service's trusted flow; only this explicit HTTP retry is admin-only.

### POST /api/tickets/:ticketId/draft

Body `{}` or `{"regenerate":false}` retrieves/creates a proposal. `{"regenerate":true}` explicitly generates a replacement, subject to the same per-ticket/task thirty-second claim/cooldown. Response:
```json
{"data":{"text":"Thank you for raising your concern…","provider":"MOCK","model":"deterministic-v1","generatedAt":"2026-10-24T06:00:00.000Z","stale":false,"cached":true}}
```
One persisted draft is cached against original query, status, bounded public history/omission metadata, book facts, effective classification and provider/model/prompt/KB versions. A cache hit makes no provider call; existing stale text is returned with stale:true without automatic regeneration. Changed context while generating returns 409 DRAFT_CONTEXT_CHANGED; superseded claim 409 AI_STALE. CLOSED returns 409 TICKET_CLOSED. Running/recent attempt returns 429 AI_COOLDOWN. Provider/configuration failure returns 503 AI_UNAVAILABLE and retains a manual composer and any previous cache. No GET method is provided (405); private/no-store still applies even though the application maintains a server-side draft cache.

Admin opening issues this POST once; polling/refocus never issue it. Arriving drafts fill an empty editor; non-empty text is preserved with a one-line preview and View popup for explicit replacement. No API contract changes are needed for this UI behavior. The UI labels MOCK explicitly. Editing/sending is separate: POST /api/tickets/:ticketId/messages with reviewed body and retry UUID is the only public send operation. Draft generation never adds public messages or changes status.
