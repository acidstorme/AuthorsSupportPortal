# Planned Playwright tests

Playwright APIRequestContext powers the hosted HTTP harnesses, including test:admin:hosted and test:ai:hosted. Those passed with the supplied CA in Milestone 5. Chromium's executable is not installed in this environment, so browser-driven rendering/edit-preservation/polling flows remain a delivery verification item. Later browser tests should use separate author/admin contexts. HTTP/unit tests are not browser E2E coverage; see docs/TESTING.md.

Draft-preview follow-up: npm run test:ai:composer -- development now passes in installed system Edge (headless Playwright msedge channel). It uses real admin sign-in/SSR and intercepted synthetic ticket APIs to verify empty/after-send autofill, retained edits, one-line preview, full read-only modal, explicit replacement, Escape and edits during generation. No model calls or ticket writes occur. Full portal/polling browser coverage remains separate delivery work.
