# AI design

## Status and model

Milestone 5 implements structured classification, deterministic MOCK and real OPENAI providers, a versioned assignment Knowledge Base, persisted draft caching and an editable admin composer. Opening an open admin ticket makes one explicit POST for a cached/new draft; polling/refocus/ordinary rendering never generate or resend. No generated reply is sent automatically.

Configured default remains `gpt-4o-mini`, matching the assignment's inexpensive focused-task suggestion. The [official model page](https://developers.openai.com/api/docs/models/gpt-4o-mini) lists it as deprecated; the user explicitly approved using the existing OPENAI_MODEL setting instead of silently replacing it. On 24 October 2026 the configured alias worked, resolving to gpt-4o-mini-2024-07-18. Future account/model availability is not guaranteed. OPENAI_MODEL is configurable. Classification uses the Responses API with strict JSON schema via the installed SDK's zodTextFormat/parse helper, following [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Drafts use Responses text output. Both use store:false, no tools and no SDK retries.

## Provider contract

AIProvider.classify(context) returns validated category/priority; draft(context) returns text. Providers expose kind/model provenance. Real and deterministic mock implementations share contracts. Admin classification and draft labels distinguish MOCK from OPENAI; live-mode failure never silently becomes mock output. Mock priority/category rules are test heuristics, not AI quality claims.

Classification uses a strict enum-only structured schema and Zod validation. Valid shape does not guarantee semantic correctness. The six categories and four priorities match the database exactly; manuals override each AI value independently.

## Bounded classification

1. Persist ticket OPEN/event first.
2. Atomically claim classification using AI status and started timestamp.
3. Await one request, eight-second deadline, SDK automatic retries disabled, output budget about 150 tokens.
4. Validate result and save AI fields plus audit event; never include manual fields in that update.
5. Failure/refusal/timeout becomes FAILED with a sanitized error code/event when the database is available. Ticket creation still returns success even if later AI/database bookkeeping fails; an interrupted write can leave PENDING/RUNNING for explicit retry. Previous successful AI fields are retained on a failed retry; manual values are never modified.

No unawaited promises, transactions spanning provider calls, queues or indefinite retries. Admin retry is explicit with a per-ticket thirty-second claim/cooldown for each task, including failed/successful attempts. Started timestamp identifies the current claim; newer claims reject stale completions. Provider deadlines are eight/fifteen seconds; ordinary bounded DB connection/transaction operations add latency. Route maxDuration is 60 seconds, subject to host plan limits; deployment execution limits remain a delivery verification item. Creation returns the persisted pre-classification DTO, so detail/list fetches expose the latest effective classification. Replayed creation requests never repeat classification.

Priority is a documented triage heuristic, not a new SLA. ISBN error reports are at least HIGH, and materially overdue royalty complaints outrank routine bio changes. Include examples across six categories and four priority levels; human admins can correct either value.

## Draft caching and review

On admin ticket opening, AIComposer issues one POST to `/api/tickets/:id/draft`; no generation is hidden in GET, polling or refocus. Concurrent initial requests are deduplicated by a conditional draft_started_at claim, in addition to the UI's one-open guard. A repeated POST returns saved text without paid generation. A running/recent claim returns 429 with manual writing available. CLOSED tickets reject drafts until explicitly reopened.

Cache one latest draft on the ticket with text, context SHA-256 fingerprint, completion time, provider/model and prompt/KB version. The fingerprint covers original query, current status, relevant public conversation/omission count, selected book facts, effective category/priority, provider/model and prompt/KB versions. Existing stale drafts are returned labelled stale, without generation; only explicit regeneration replaces them. Before saving a new draft the service checks context again; stored fingerprints also detect later races/context changes on retrieval. Error/stale completions do not erase the last saved draft. Initial and cached DTOs share the exact persisted completion timestamp.

Generation deadline: fifteen seconds. Failure leaves the manual composer. When a draft arrives, an empty/whitespace-only editor is populated automatically, including after sending or clearing text. A non-empty editor is preserved and the new text appears as a one-line preview headed AI generated response, below the draft buttons. View opens a native modal with the complete read-only response and Use generated text in editor at the bottom; replacement closes the modal and focuses the editor. Close/Escape dismiss without replacing text. The arrival-time editor value protects text typed while generation was running. Sending submits the editor text with a retry UUID through the regular public-message endpoint. Draft generation never inserts a public message, changes status or performs an operational action. Core Auth/DB validation ignores optional AI settings while retaining role/project/TLS checks, so missing/broken AI configuration cannot disable tickets/manual support. Full env:check still validates AI configuration separately.

## Knowledge Base and grounding

src/server/ai/knowledge-base.ts faithfully transcribes the supplied PDF policies and identifies the approved limitations of its operational examples. Company/tone always apply; effective category plus deterministic original/recent-message keywords select relevant sections. For uncertain queries the complete eight-section KB is a bounded fallback. No embeddings/vector search or external retrieval.

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
- Drafts: original subject/description (validated 200/8000 characters), selected book facts, up to six latest public replies (1000 characters each), selected KB, and 700 output tokens. Omitted message counts/truncation flags are explicit. This is a character/context budget, not a hard 6,000-input-token guarantee across languages; usage logs provide actual token counts.
- Log resolved model, token counts and provider request ID on successful real calls; persist provider/model/prompt and sanitized error codes. No full prompts, contact data, keys or raw provider errors are logged. Phone/contact fields and private notes are not selected into provider context; personal information authors type in their ticket text can still be transmitted.
- Dated smoke usage (24 October 2026): 857 input and 165 output tokens across two real calls. At the official model page's USD 0.15/1M input and 0.60/1M output rates, the estimate is USD 0.00022755, excluding any account-specific billing factors. This is an estimate, not an invoice/monthly projection. No global spend limiter is implemented; per-ticket cooldown, bounded outputs, selected KB and persisted cache reduce repeat usage.
- Test deterministic real-provider adapter failures and mock outcomes in CI. Live-model evaluation is opt-in and must report the model, prompt/KB version and date.

Deterministic fixtures cover all six categories/four priorities, manual-field isolation, failures, cache/cooldown/stale context, unavailable financial facts, below-threshold snapshots, production nulls, multi-topic selection and malicious instructions. A real synthetic ISBN smoke test verified schema/category/priority and produced a draft reviewed for unsupported actions. This is not a broad live-model/adversarial accuracy benchmark. Human review reduces risk but does not eliminate hallucination/prompt injection. Full conversations may exceed the bounded recent context; private notes are intentionally excluded. See TESTING for exact executed results.
