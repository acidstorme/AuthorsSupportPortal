# HTTP verification

M2 adds mocked handler tests in tests/unit/http-handlers.test.ts, actual anonymous HTTP checks via npm run test:smoke, and an opt-in real hosted harness via npm run test:hosted -- development. The hosted harness requires completed safety/configuration checks and a running app; it has not been executed. See docs/TESTING.md for actual results.
