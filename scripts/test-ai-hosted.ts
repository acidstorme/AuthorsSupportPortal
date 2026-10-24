import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv } from "../src/server/config/env-schema";
import { createSetupClients } from "./lib/adapters";
import { loadSource } from "./lib/source";
import { assertMigrations, assertRuntimeAndEmailSafety, assertSignupDisabled } from "./lib/preflight";
loadProjectEnv();
const sessions: APIRequestContext[] = [];
let clients: ReturnType<typeof createSetupClients> | undefined;
let stage = "configuration";
try {
  const env = parseDemoEnv(process.env, process.argv[2]);
  assert.equal(env.AI_MODE, "mock", "Hosted AI workflow tests require deterministic mock mode in app and test processes.");
  clients = createSetupClients(env);
  stage = "safety preflight";
  await assertSignupDisabled(env); await assertMigrations(clients.db); await assertRuntimeAndEmailSafety(clients.db, env);
  stage = "sign-in";
  for (const [email, password] of [[loadSource().authors[0].email, env.DEMO_AUTHOR_PASSWORD], [env.DEMO_ADMIN1_EMAIL, env.DEMO_ADMIN_PASSWORD]]) {
    const session = await request.newContext({ baseURL: env.APP_URL, extraHTTPHeaders: { Origin: new URL(env.APP_URL).origin }, timeout: 30000 });
    sessions.push(session); assert.equal((await session.post("/api/auth/login", { data: { email, password } })).status(), 200);
  }
  const [author, admin] = sessions;
  stage = "creation and classification";
  const response = await author.post("/api/tickets", { data: { subject: `[Milestone 5 verification] Royalty unpaid for 6 months ${randomUUID()}`, description: "Synthetic AI workflow test. No support action required.", requestId: randomUUID(), bookId: null } });
  assert.equal(response.status(), 201); const ticket = (await response.json()).data; const path = `/api/tickets/${ticket.id}`;
  const detail = await admin.get(`/api/admin/tickets/${ticket.id}`); assert.equal(detail.status(), 200);
  const classified = (await detail.json()).data;
  if (process.argv[3] === "failure") {
    // Run against a separate app process with AI_MODE=openai and OPENAI_API_KEY=replace-me.
    // The test process stays in mock mode for its own safety/configuration preflight.
    assert.equal(classified.aiStatus, "FAILED"); assert.equal(classified.aiErrorCode, "PROVIDER_UNAVAILABLE");
    assert.equal((await admin.post(`${path}/draft`, { data: {} })).status(), 503);
    const manual = "Manual response while AI is unavailable: please share the period for team review.";
    assert.equal((await admin.post(`${path}/messages`, { data: { body: manual, requestId: randomUUID() } })).status(), 201);
    assert.equal((await (await author.get(`${path}/messages`)).json()).data.at(-1).body, manual);
    console.log("PASS: real Auth/DB ticket creation and manual response remain available with invalid AI configuration; FAILED triage is persisted and draft failure is sanitized.");
    console.log("Retained AI-failure demo ticket and manual reply:", ticket.id);
  } else {
  assert.equal(classified.aiStatus, "SUCCEEDED"); assert.equal(classified.aiProvider, "MOCK"); assert.equal(classified.category, "ROYALTY_PAYMENTS"); assert.equal(classified.priority, "CRITICAL");
  assert.equal((await author.post(`${path}/draft`, { data: {} })).status(), 403);
  assert.equal((await author.post(`${path}/classification`, { data: {} })).status(), 403);
  stage = "draft cache and explicit review";
  const before = (await (await author.get(`${path}/messages`)).json()).meta.total;
  const first = await admin.post(`${path}/draft`, { data: {} }); assert.equal(first.status(), 200); const draft = (await first.json()).data;
  assert.equal(draft.provider, "MOCK"); assert.equal(draft.cached, false); assert.equal(draft.stale, false);
  const again = await admin.post(`${path}/draft`, { data: {} }); assert.equal(again.status(), 200);
  const cached = (await again.json()).data; assert.equal(cached.cached, true); assert.equal(cached.text, draft.text); assert.equal(cached.generatedAt, draft.generatedAt);
  assert.equal((await (await author.get(`${path}/messages`)).json()).meta.total, before, "Generating a draft must never send a message.");
  assert.equal((await admin.post(`${path}/draft`, { data: { regenerate: true } })).status(), 429);
  stage = "context invalidation and manual precedence";
  assert.equal((await admin.patch(path, { data: { manualCategory: "GENERAL_INQUIRY", manualPriority: "LOW" } })).status(), 200);
  const stale = await admin.post(`${path}/draft`, { data: {} }); assert.equal((await stale.json()).data.stale, true);
  assert.equal((await admin.post(`${path}/classification`, { data: {} })).status(), 429);
  assert.equal((await (await admin.get(`/api/admin/tickets/${ticket.id}`)).json()).data.priority, "LOW");
  const finalText = "Reviewed by an administrator: please share the royalty period so the team can review your concern.";
  assert.equal((await admin.post(`${path}/messages`, { data: { body: finalText, requestId: randomUUID() } })).status(), 201);
  const messages = (await (await author.get(`${path}/messages`)).json()).data;
  assert.equal(messages.at(-1).body, finalText); assert.equal(messages.at(-1).sender.role, "ADMIN");
  const publicDetail = await author.get(path); assert.equal((await publicDetail.text()).includes(draft.text), false);
  console.log("PASS: hosted MOCK classification, admin-only draft/retry, persisted cache, cooldown, stale context, manual overrides, no automatic send and edited response visible to author.");
  console.log("Retained synthetic ticket and reviewed reply:", ticket.id);
  }
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `Hosted AI test stopped during ${stage}. Check setup, runtime, certificate trust and matching mock mode. No secrets logged.`);
  process.exitCode = 1;
} finally { await Promise.all(sessions.map((s) => s.dispose())); await clients?.db.$disconnect(); }
