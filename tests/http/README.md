# HTTP verification

Mocked handler tests cover auth and tickets using the real service/validation code. Actual anonymous checks run via npm run test:smoke. Opt-in hosted harnesses: npm run test:hosted -- development for identity/books, and npm run test:tickets:hosted -- development for ticket creation/concurrency/ownership. Both require a running app and full safety preflight. The latter retains labelled demo records; its agent execution stopped before writes at certificate validation. See docs/TESTING.md for exact results and gaps.
