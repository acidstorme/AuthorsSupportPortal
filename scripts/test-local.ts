import assert from "node:assert/strict";

// No hosted calls or accounts: exercise anonymous routes and pre-auth validation only.
const origin = process.argv[2] ?? "http://localhost:3000";
const url = new URL(origin);
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Smoke tests require a localhost URL.");
let checked = 0;
async function check(path: string, status: number, options?: RequestInit) {
  const response = await fetch(new URL(path, origin), { ...options, redirect: "manual" });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`); checked++;
  return response;
}
const home = await check("/", 200); assert.ok((await home.text()).includes("Sign in"));
const login = await check("/login", 200); assert.ok((await login.text()).includes("Welcome back"));
for (const path of ["/api/me", "/api/books", "/api/books/BK001", "/api/admin/overview", "/api/tickets", "/api/tickets/11111111-1111-4111-8111-111111111111", "/api/tickets/11111111-1111-4111-8111-111111111111/messages"]) {
  const response = await check(path, 401); assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
}
const ticketPath = "/api/tickets/11111111-1111-4111-8111-111111111111";
for (const path of ["/api/admin/tickets", "/api/admin/tickets/11111111-1111-4111-8111-111111111111", `${ticketPath}/notes`, `${ticketPath}/events`]) await check(path, 401);
for (const path of ["/author", "/admin", "/author/tickets/new", "/author/tickets/11111111-1111-4111-8111-111111111111"]) {
  const response = await check(path, 307); assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/login");
}
await check("/admin/tickets/11111111-1111-4111-8111-111111111111", 307);
for (const [suffix, method] of [["", "PATCH"], ["/assignment", "PUT"], ["/assignment", "DELETE"], ["/notes", "POST"], ["/acknowledge", "POST"]]) await check(ticketPath + suffix, 401, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : "{}" });
for (const suffix of ["/draft", "/classification"]) {
  await check(ticketPath + suffix, 401, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
  await check(ticketPath + suffix, 405);
}
await check("/api/auth/login", 403, { method: "POST", headers: { Origin: "https://untrusted.example.invalid", "Content-Type": "application/json" }, body: "{}" });
await check("/api/auth/login", 422, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
await check("/api/auth/login", 400, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{" });
await check("/api/auth/login", 422, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "probe@example.invalid", password: "fixture", role: "ADMIN" }) });
await check("/api/auth/logout", 204, { method: "POST", headers: { Origin: origin } });
await check("/api/tickets", 401, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
await check("/api/tickets/11111111-1111-4111-8111-111111111111/messages", 401, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
await check("/api/auth/signup", 404, { method: "POST" });
console.log(`PASS: ${checked} anonymous HTTP smoke checks. No credentials, sessions, emails or hosted data operations were used.`);
