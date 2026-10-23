import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv } from "../src/server/config/env-schema";
import { createSetupClients } from "./lib/adapters";
import { loadSource } from "./lib/source";
import { assertMigrations, assertRuntimeAndEmailSafety, assertSignupDisabled } from "./lib/preflight";

// Opt-in integration test: keeps one general and one book demo ticket plus two replies.
// No account provisioning, deletion, emails, password resets or status changes.
loadProjectEnv();
const sessions: APIRequestContext[] = [];
let clients: ReturnType<typeof createSetupClients> | undefined;
let stage = "environment validation";
try {
  const env = parseDemoEnv(process.env, process.argv[2]);
  clients = createSetupClients(env);
  stage = "signup safety check"; await assertSignupDisabled(env);
  stage = "migration verification"; await assertMigrations(clients.db);
  stage = "runtime and email safety check"; await assertRuntimeAndEmailSafety(clients.db, env);
  const source = loadSource();
  const authors = source.authors.slice(0, 2);
  stage = "author login";
  for (const author of authors) {
    const session = await request.newContext({ baseURL: env.APP_URL, extraHTTPHeaders: { Origin: new URL(env.APP_URL).origin }, timeout: 20000 });
    sessions.push(session);
    assert.equal((await session.post("/api/auth/login", { data: { email: author.email, password: env.DEMO_AUTHOR_PASSWORD } })).status(), 200);
  }
  stage = "ticket HTTP assertions";
  const [a, b] = sessions;
  const input = { subject: "[Milestone 3 verification] General inquiry", description: "Synthetic integration test; no support action required.", bookId: null, requestId: randomUUID() };
  const [first, retry] = await Promise.all([a.post("/api/tickets", { data: input }), a.post("/api/tickets", { data: input })]);
  assert.deepEqual([first.status(), retry.status()].sort(), [200, 201]);
  const created = (await first.json()).data;
  assert.equal(created.id, (await retry.json()).data.id); assert.equal(created.status, "OPEN");
  assert.equal(created.category, null); assert.equal(created.priority, null);
  assert.equal((await a.post("/api/tickets", { data: { ...input, subject: "Conflicting retry" } })).status(), 409);
  assert.equal((await b.get(`/api/tickets/${created.id}`)).status(), 404);
  assert.equal((await b.get(`/api/tickets/${created.id}/messages`)).status(), 404);
  assert.equal((await b.post(`/api/tickets/${created.id}/messages`, { data: { body: "Denied", requestId: randomUUID() } })).status(), 404);
  assert.equal((await a.post("/api/tickets", { data: { ...input, bookId: authors[1].books[0].book_id, requestId: randomUUID() } })).status(), 422);
  const bookTicket = await a.post("/api/tickets", { data: { ...input, subject: "[Milestone 3 verification] Book inquiry", bookId: authors[0].books[0].book_id, requestId: randomUUID() } });
  assert.equal(bookTicket.status(), 201);
  const reply = { body: "Synthetic public reply", requestId: randomUUID() };
  const sent = await Promise.all([a.post(`/api/tickets/${created.id}/messages`, { data: reply }), a.post(`/api/tickets/${created.id}/messages`, { data: reply })]);
  assert.deepEqual(sent.map((r) => r.status()).sort(), [200, 201]);
  assert.equal((await a.post(`/api/tickets/${created.id}/messages`, { data: { ...reply, body: "Changed" } })).status(), 409);
  assert.equal((await a.post(`/api/tickets/${created.id}/messages`, { data: { body: "Second message for pagination", requestId: randomUUID() } })).status(), 201);
  const page = await a.get(`/api/tickets/${created.id}/messages?page=2&pageSize=1`);
  assert.equal(page.status(), 200); const content = await page.json(); assert.equal(content.meta.total, 2); assert.equal(content.data.length, 1);
  assert.equal(content.data[0].body, "Second message for pagination");
  const detail = (await (await a.get(`/api/tickets/${created.id}`)).json()).data;
  assert.equal(detail.status, "OPEN"); assert.equal("draftText" in detail, false); assert.equal("notes" in detail, false);
  const queue = await a.get("/api/tickets?status=OPEN&sort=updated_desc&pageSize=1");
  assert.equal(queue.status(), 200); assert.ok((await queue.json()).meta.total >= 2);
  const count = await clients.db.ticketEvent.count({ where: { ticketId: created.id } }); assert.equal(count, 3);
  console.log("PASS: actual HTTP ticket creation, concurrent idempotency, author isolation, book ownership, messages, pagination, filtering and atomic audit counts.");
  console.log("Retained synthetic demo tickets:", created.id, (await bookTicket.json()).data.id);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `Hosted ticket checks stopped during ${stage}. Verify environment, safety, TLS, seeded accounts and running application. No secrets logged.`);
  process.exitCode = 1;
} finally {
  await Promise.all(sessions.map((session) => session.dispose()));
  await clients?.db.$disconnect();
}
