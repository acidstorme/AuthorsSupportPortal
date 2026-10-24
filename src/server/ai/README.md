# AI integration boundary

Milestone 5 implements structured classification and grounded response drafting via real OpenAI Responses and deterministic MOCK providers. knowledge-base.ts transcribes assignment policies with explicit unsupported-action limitations; contracts.ts owns schemas/grounding rules. Providers see only scoped public context and selected KB, not notes/contact fields. Ticket text is untrusted; no tools are granted.

Services/repositories handle claims, caching/fingerprints, manual precedence and conditional completion independently of providers. Real mode uses server-only credentials, store:false, no SDK retries and eight/fifteen-second deadlines. Failure never silently becomes mock output. See docs/AI_DESIGN.md and TESTING for exact behavior, cost and limits.
