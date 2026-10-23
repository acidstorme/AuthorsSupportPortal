import assert from "node:assert/strict";
import { request, type APIRequestContext } from "@playwright/test";
import { z } from "zod";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv } from "../src/server/config/env-schema";
import { createSetupClients } from "./lib/adapters";
import { loadSource } from "./lib/source";
import { desiredIdentities } from "./lib/provisioning";
import { assertMigrations, assertRuntimeAndEmailSafety, assertSignupDisabled } from "./lib/preflight";
import { verifySetup } from "./lib/verify";
import { isSessionCookie } from "../src/server/auth/cookie-policy";

// Explicit opt-in hosted HTTP tests. Creates sessions, never accounts, resets or emails.
loadProjectEnv();
const contexts: APIRequestContext[] = [];
let clients: ReturnType<typeof createSetupClients> | undefined;
try {
  const env = parseDemoEnv(process.env, process.argv[2]);
  clients = createSetupClients(env);
  await assertSignupDisabled(env); await assertMigrations(clients.db); await assertRuntimeAndEmailSafety(clients.db, env);
  const data = loadSource();
  const all = desiredIdentities(data, env.DEMO_ADMIN1_EMAIL, env.DEMO_ADMIN2_EMAIL);
  console.log("Hosted inventory:", await verifySetup(clients.db, data, all, clients.auth, clients.store, env.SUPABASE_PROJECT_REF));
  const context = async () => {
    const value = await request.newContext({ baseURL: env.APP_URL, extraHTTPHeaders: { Origin: new URL(env.APP_URL).origin }, timeout: 20_000 });
    contexts.push(value); return value;
  };
  const anonymous = await context();
  assert.equal((await anonymous.get("/api/me")).status(), 401);
  assert.equal((await anonymous.get("/api/admin/overview")).status(), 401);
  for (const path of ["/author", "/admin"]) {
    const response = await anonymous.get(path, { maxRedirects: 0 });
    assert.equal(response.status(), 307); assert.equal(new URL(response.headers().location, env.APP_URL).pathname, "/login");
  }
  const crossOrigin = await anonymous.post("/api/auth/login", { headers: { Origin: "https://untrusted.example.invalid" }, data: { email: all[0].email, password: env.DEMO_AUTHOR_PASSWORD } });
  assert.equal(crossOrigin.status(), 403);
  for (const identity of all) {
    const session = await context();
    const login = await session.post("/api/auth/login", { data: { email: identity.email, password: identity.kind === "AUTHOR" ? env.DEMO_AUTHOR_PASSWORD : env.DEMO_ADMIN_PASSWORD } });
    assert.equal(login.status(), 200, `${identity.sourceId}: configured login failed; existing passwords are never reset automatically.`);
    const result = await login.json();
    assert.equal(result.data.user.role, identity.kind);
    assert.equal(result.data.redirectTo, identity.kind === "AUTHOR" ? "/author" : "/admin");
    assert.equal("session" in result.data, false);
    const me = await session.get("/api/me"); assert.equal(me.status(), 200);
    const user = (await me.json()).data;
    assert.equal(user.email, identity.email); assert.equal(user.role, identity.kind);
    const state = await session.storageState();
    const sessionCookies = state.cookies.filter((cookie) => isSessionCookie(cookie.name, env.SUPABASE_PROJECT_REF));
    assert.ok(sessionCookies.length > 0); assert.ok(sessionCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax" && cookie.secure === (new URL(env.APP_URL).protocol === "https:")));
    const landing = await session.get(identity.kind === "AUTHOR" ? "/author" : "/admin");
    assert.equal(landing.status(), 200); assert.ok((await landing.text()).includes(identity.email));
    if (identity.author) {
      assert.equal(user.authorId, identity.sourceId);
      const books = await session.get("/api/books"); assert.equal(books.status(), 200);
      const body = await books.json();
      assert.equal(body.meta.total, identity.author.books.length);
      assert.deepEqual(body.data.map((book: { bookId: string }) => book.bookId).sort(), identity.author.books.map((book) => book.book_id).sort());
      assert.equal((await session.get("/api/admin/overview")).status(), 403);
      const other = data.authors.find((author) => author.author_id !== identity.sourceId)!;
      assert.equal((await session.get(`/api/books/${other.books[0].book_id}`)).status(), 404);
      assert.equal((await session.get(`/api/books?authorId=${other.author_id}`)).status(), 403);
      const deniedPage = await session.get("/admin", { maxRedirects: 0 }); assert.equal(deniedPage.status(), 307);
      assert.equal(new URL(deniedPage.headers().location, env.APP_URL).pathname, "/author");
    } else {
      assert.equal(user.authorId, null);
      assert.equal((await session.get("/api/admin/overview")).status(), 200);
      assert.equal((await (await session.get("/api/books?pageSize=100")).json()).meta.total, 18);
    }
    assert.equal((await session.post("/api/auth/logout")).status(), 204);
    assert.equal((await session.get("/api/me")).status(), 401);
  }
  console.log("PASS: all 12 configured logins, correct roles/landings, HTTP-only cookies, book ownership, admin restrictions, anonymous denial, origin protection and logout. No ticket functionality tested.");
} catch (error) {
  console.error(error instanceof z.ZodError ? "Hosted tests blocked by incomplete/unsafe setup configuration." : error instanceof assert.AssertionError ? error.message : "Hosted HTTP tests could not complete. Check safety preflight, live services, setup and the local app. No raw credentials or session data logged.");
  process.exitCode = 1;
} finally {
  await Promise.all(contexts.map((context) => context.dispose()));
  await clients?.db.$disconnect();
}
