# Planned Playwright tests

Playwright's APIRequestContext supports the opt-in hosted HTTP harnesses, including test:admin:hosted for lifecycle/private-note/concurrency checks. Browser-driven flows/binaries remain unverified. Later browser tests should use separate author/admin contexts for conversation, private notes, status/attention and polling. See docs/TESTING.md; mocked/unit and HTTP checks are not claimed as browser E2E coverage.
