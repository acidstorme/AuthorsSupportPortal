# HTTP verification

Mocked handler tests cover auth and tickets using the real service/validation code. Actual anonymous checks run via npm run test:smoke. Opt-in hosted harnesses: npm run test:hosted -- development for identity/books, and npm run test:tickets:hosted -- development for ticket creation/concurrency/ownership. Both require a running app and full safety preflight. The latter retains labelled demo records; its agent execution stopped before writes at certificate validation. See docs/TESTING.md for exact results and gaps.

Milestone 4 adds admin-ticket-http.test.ts for queue/detail, status, assignment, private notes/events and acknowledgement, including author/anonymous denial. npm run test:admin:hosted -- development is the opt-in lifecycle/private-note/close-reply harness; it retains one labelled demo ticket and stopped at migration preflight in the agent environment. Anonymous actual HTTP smoke checks now total 31.
