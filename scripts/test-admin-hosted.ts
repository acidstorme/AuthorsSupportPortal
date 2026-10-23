import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv } from "../src/server/config/env-schema";
import { createSetupClients } from "./lib/adapters";
import { loadSource } from "./lib/source";
import { assertMigrations, assertRuntimeAndEmailSafety, assertSignupDisabled } from "./lib/preflight";
// Opt-in: retains one labelled ticket, private note, public replies and audit events.
// Uses only APIs for ticket changes; no account creation, resets, mail or cleanup deletion.
loadProjectEnv();
const contexts: APIRequestContext[] = [];
let clients: ReturnType<typeof createSetupClients> | undefined;
let stage = "configuration";
try {
  const env = parseDemoEnv(process.env, process.argv[2]); clients = createSetupClients(env);
  stage = "signup safety"; await assertSignupDisabled(env);
  stage = "migration verification"; await assertMigrations(clients.db);
  stage = "runtime/email safety"; await assertRuntimeAndEmailSafety(clients.db, env);
  const authorRecord = loadSource().authors[0];
  stage = "sign-in";
  for (const [email, password] of [[authorRecord.email, env.DEMO_AUTHOR_PASSWORD], [env.DEMO_ADMIN1_EMAIL, env.DEMO_ADMIN_PASSWORD], [env.DEMO_ADMIN2_EMAIL, env.DEMO_ADMIN_PASSWORD]]) {
    const context = await request.newContext({ baseURL: env.APP_URL, extraHTTPHeaders: { Origin: new URL(env.APP_URL).origin }, timeout: 20000 });
    contexts.push(context); assert.equal((await context.post("/api/auth/login", { data: { email, password } })).status(), 200);
  }
  const [author, admin, secondAdmin] = contexts;
  stage = "ticket creation";
  const created = await author.post("/api/tickets", { data: { subject: `[Milestone 4 verification] ${randomUUID()}`, description: "Synthetic lifecycle test; no support action needed.", requestId: randomUUID(), bookId: null } });
  assert.equal(created.status(), 201); const ticket = (await created.json()).data; const path = `/api/tickets/${ticket.id}`;
  stage = "admin RBAC and assignment";
  assert.equal((await author.get("/api/admin/tickets")).status(), 403);
  assert.equal((await author.patch(path, { data: { status: "CLOSED" } })).status(), 403);
  const assigned = await admin.put(`${path}/assignment`, { data: {} }); assert.equal(assigned.status(), 200); assert.equal((await assigned.json()).data.status, "OPEN");
  assert.equal((await secondAdmin.get(`/api/admin/tickets/${ticket.id}`)).status(), 200);
  stage = "manual classification and queue filters";
  const classified = await admin.patch(path, { data: { manualPriority: "CRITICAL", manualCategory: "GENERAL_INQUIRY", status: "IN_PROGRESS" } });
  assert.equal(classified.status(), 200); assert.equal((await classified.json()).data.priority, "CRITICAL");
  const queue = await admin.get(`/api/admin/tickets?priority=CRITICAL&category=GENERAL_INQUIRY&assignment=mine&search=${encodeURIComponent(ticket.subject)}&sort=priority_desc`);
  assert.equal(queue.status(), 200); assert.ok((await queue.json()).data.some((row: { id: string }) => row.id === ticket.id));
  stage = "private note visibility";
  const privateText = `Private test note ${randomUUID()}`;
  const noteInput = { body: privateText, requestId: randomUUID() };
  assert.equal((await admin.post(`${path}/notes`, { data: noteInput })).status(), 201);
  assert.equal((await admin.post(`${path}/notes`, { data: noteInput })).status(), 201);
  const notePage = await admin.get(`${path}/notes`); assert.ok((await notePage.text()).includes(privateText));
  for (const suffix of ["/notes", "/events"]) assert.equal((await author.get(path + suffix)).status(), 403);
  for (const suffix of ["", "/messages"]) assert.equal((await (await author.get(path + suffix)).text()).includes(privateText), false);
  stage = "resolved reply and acknowledgement";
  assert.equal((await admin.patch(path, { data: { status: "RESOLVED" } })).status(), 200);
  assert.equal((await author.post(`${path}/messages`, { data: { body: "Reply to resolved ticket", requestId: randomUUID() } })).status(), 201);
  const attention = (await (await admin.get(`/api/admin/tickets/${ticket.id}`)).json()).data;
  assert.equal(attention.status, "RESOLVED"); assert.equal(attention.needsAttention, true);
  assert.equal((await admin.post(`${path}/acknowledge`, { data: { observedReplyAt: attention.resolvedAuthorReplyAt } })).status(), 200);
  assert.equal((await (await admin.get(`/api/admin/tickets/${ticket.id}`)).json()).data.needsAttention, false);
  stage = "close/reply concurrency";
  const [closed, racingReply] = await Promise.all([
    admin.patch(path, { data: { status: "CLOSED" } }),
    author.post(`${path}/messages`, { data: { body: "Concurrent close/reply test", requestId: randomUUID() } }),
  ]);
  assert.equal(closed.status(), 200); assert.ok([201, 409].includes(racingReply.status()));
  for (const context of [author, admin]) assert.equal((await context.post(`${path}/messages`, { data: { body: "Must reject after closure", requestId: randomUUID() } })).status(), 409);
  stage = "explicit reopening and history";
  const reopened = await admin.patch(path, { data: { status: "OPEN", manualPriority: null, manualCategory: null } });
  assert.equal(reopened.status(), 200); assert.equal((await reopened.json()).data.status, "OPEN");
  assert.equal((await admin.delete(`${path}/assignment`)).status(), 200);
  assert.equal((await admin.post(`${path}/messages`, { data: { body: "Public admin reply after reopening", requestId: randomUUID() } })).status(), 201);
  const events = await admin.get(`${path}/events?pageSize=100`); assert.equal(events.status(), 200);
  assert.ok((await events.json()).data.some((event: { type: string }) => event.type === "STATUS_CHANGED"));
  console.log("PASS: real HTTP admin queue, both admins, assignment, manual triage, private notes, lifecycle, resolved attention, close/reply race, reopening and audit history.");
  console.log("Retained labelled demo ticket:", ticket.id);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `Hosted admin verification stopped during ${stage}. Check configuration, certificate trust, safety and the running app. No secrets logged.`);
  process.exitCode = 1;
} finally {
  await Promise.all(contexts.map((context) => context.dispose())); await clients?.db.$disconnect();
}
