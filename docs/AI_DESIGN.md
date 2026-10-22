# AI design

## Status and model

Milestone 1 installs the OpenAI SDK and validates future mode/model/key configuration. **No OpenAI request, deterministic mock provider, classification, draft cache service or prompt implementation is active yet.** AI-related database fields are foundations only.

Planned default: configurable `gpt-4o-mini`, justified by the assignment's recommendation, low-cost focused tasks and structured-output support. Evaluate against category/priority and grounded-response fixtures before committing to live-demo quality. Use OpenAI's [model documentation](https://developers.openai.com/api/docs/models/gpt-4o-mini) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) when implementing. Model availability for the eventual account remains unverified.

## Provider contract

Future `classifyTicket(context)` returns validated category/priority; `draftResponse(context)` returns draft text and provider/model provenance. Real and deterministic mock implementations share contracts. UI and stored metadata distinguish MOCK from OPENAI; live-mode failure must never silently become mock output.

Classification uses a strict enum-only structured schema and Zod validation. Valid shape does not guarantee semantic correctness. The six categories and four priorities match the database exactly; manuals override each AI value independently.

## Bounded classification

1. Persist ticket OPEN/event first.
2. Atomically claim classification using AI status and started timestamp.
3. Await one request, eight-second deadline, SDK automatic retries disabled, output budget about 150 tokens.
4. Validate result and save AI fields plus audit event; never include manual fields in that update.
5. Failure/refusal/timeout becomes FAILED with sanitized error code. Ticket creation still returns success.

No unawaited background promises, transaction spanning provider calls, queues or indefinite retries. Admin retry is explicit and rate-limited. Started timestamp acts as the ownership token for a short expiring claim; a timed-out handler leaves retryable persisted work. A newer claim prevents stale completion writes. A minimum thirty-second stale threshold is longer than the request deadline; exact deployment execution limits must be verified before rollout.

Priority is a documented triage heuristic, not a new SLA. ISBN error reports are at least HIGH, and materially overdue royalty complaints outrank routine bio changes. Include examples across six categories and four priority levels; human admins can correct either value.

## Draft caching and review

On admin ticket opening, issue an explicit POST to `/api/tickets/:id/draft`; never cause paid generation inside a GET, ordinary React render, polling or refocus query. The server returns the persisted valid cache when possible. Deduplicate concurrent initial requests through `draft_started_at` conditional claim, not browser behavior alone.

Cache one latest draft on the ticket with text, context SHA-256 fingerprint, generation time, provider/model and prompt/KB version. Fingerprint relevant public conversation content, original query, book facts, effective category and prompt/KB identity. New context marks an existing draft stale; require explicit regeneration rather than discarding admin edits or triggering polling-driven generation. Explicit regeneration respects the in-flight claim/cooldown.

Generation deadline: fifteen seconds. Failure leaves an ordinary manual composer. Local admin edits are independent of query refresh; sending uses submitted text through the regular message endpoint. Draft generation never inserts a public message, changes status or performs an operational action.

## Knowledge Base and grounding

Version a faithful transcription of the PDF's KB during the AI milestone. Include tone/grounding rules and only relevant topic sections selected by effective category plus deterministic keyword matching. For genuinely uncertain/multi-topic requests, the small complete KB is an acceptable bounded fallback. No embeddings or vector search.

Required KB content:

- Company: India/US, Standard Free and Bestseller Breakthrough packages, publishing services, Delhi facility, named print partners.
- Royalty: 80/20 split of net profit; MRP less printing/platform/shipping costs; quarterly calculation, payment within 45 days after quarter end, INR 1,000 threshold, rollover, bank transfer.
- ISBN: BookLeaf imprint; own-imprint authors obtain their own ISBN; errors are high-priority production issues.
- Printing: typical 5-7 business days; free reprint after quality verification and possibly photos.
- Distribution: named platforms; new listings typically 7-10 business days; stock re-sync policy window 24-48 hours.
- Production: exact stage sequence, optional editing, typical approval/revision causes described only as general possibilities.
- Examples: metadata updates typically 3-5 business days; preserve useful guidance without copying unsupported confirmation claims.
- Tone: empathetic/professional, acknowledge concern, specific verified facts, honest responsibility, clear next step.

Approved resolution of PDF/example conflict: state applicable policy windows and **proposed** actions. The dataset cannot confirm bank details, payout eligibility/date, escalation completion, re-sync execution, production delay reason or publication ETA. Do not invent these. Do not promise a specific resolution unless a future trusted source establishes the commitment. Do not claim this portal supplies per-platform accounting or bank management.

Ticket text is untrusted content, not instructions. Delimit it separately, explicitly resist prompt injection, give the model no action tools, and include only the selected author's scoped context. Exclude private notes and unnecessary phone/email values. Ground numeric/date claims in supplied book values, not arithmetic extrapolation from incomplete financial data.

## Budgets, observability and evaluation

- Classification: original subject/description plus compact priority/category rules, about 150 output tokens.
- Drafts: target at most 6,000 input tokens and 700 output tokens, preserving original query and latest messages; tell the model when older messages are omitted.
- Log model/provider, latency, token counts, request ID and sanitized error classification. Avoid logging full prompts, personal contact data or API secrets.
- Estimate cost using actual usage and dated official prices at implementation; do not claim a monthly cost without usage assumptions.
- Test deterministic real-provider adapter failures and mock outcomes in CI. Live-model evaluation is opt-in and must report the model, prompt/KB version and date.

Evaluation fixtures must cover all six categories, manual override races, unavailable facts, below-threshold royalty cases, production nulls, multi-topic requests and malicious ticket instructions. Human review reduces risk but does not make hallucinations impossible. No AI quality or availability result has been claimed in Milestone 1.
