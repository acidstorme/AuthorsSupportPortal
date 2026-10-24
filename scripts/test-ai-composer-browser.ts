import assert from "node:assert/strict";
import { chromium, expect, type Browser, type Route } from "@playwright/test";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseDemoEnv } from "../src/server/config/env-schema";

// Real admin sign-in/SSR, synthetic intercepted ticket/draft/message APIs.
// No ticket writes, account provisioning or model calls; requires system Edge.
loadProjectEnv();
let browser: Browser | undefined;
try {
  const env = parseDemoEnv(process.env, process.argv[2]);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(env.APP_URL).hostname), "Use a local app for intercepted browser checks.");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ baseURL: env.APP_URL });
  const login = await context.request.post("/api/auth/login", { headers: { Origin: new URL(env.APP_URL).origin }, data: { email: env.DEMO_ADMIN1_EMAIL, password: env.DEMO_ADMIN_PASSWORD } });
  assert.equal(login.status(), 200, "Configured admin login must succeed.");
  const id = "11111111-1111-4111-8111-111111111111";
  const ticket = { id, bookId: null, subject: "Synthetic browser preview", description: "Intercepted fixture", status: "OPEN", category: null, priority: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), author: { authorId: "AUTH001", name: "Synthetic author", email: "fixture@example.test" },
    book: null, assignedTo: null, manualCategory: null, manualPriority: null, aiCategory: null, aiPriority: null, aiStatus: "PENDING", aiProvider: null, aiModel: null, aiErrorCode: null, needsAttention: false, resolvedAuthorReplyAt: null };
  const page = await context.newPage();
  let draftCalls = 0;
  let holdNext = false;
  let release: (() => void) | undefined;
  const generated = (number: number) => `Generated response ${number}. ${"Detailed response text. ".repeat(30)}\n\nNext steps for review.`;
  const respond = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/draft")) {
      const current = ++draftCalls;
      if (holdNext) { holdNext = false; await new Promise<void>((resolve) => { release = resolve; }); }
      await respond(route, { data: { text: generated(current), provider: "MOCK", model: "browser-fixture", generatedAt: new Date().toISOString(), cached: false, stale: false } });
    } else if (/\/(messages|notes|events)$/.test(path)) {
      await respond(route, route.request().method() === "GET" ? { data: [], meta: { page: 1, pageSize: 20, total: 0 } } : { data: { id: "intercepted-message" } });
    } else await respond(route, { data: ticket });
  });
  await page.goto(`/admin/tickets/${id}`);
  const editor = page.getByRole("textbox", { name: "Reviewed public response" });
  const regenerate = page.getByRole("button", { name: "Regenerate draft", exact: true });
  await expect(editor).toHaveValue(generated(1));
  await editor.fill("Unsaved administrator edits");
  await regenerate.click();
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
  await expect(editor).toHaveValue("Unsaved administrator edits");
  const preview = page.getByRole("region", { name: "AI generated response", exact: true });
  await expect(preview.locator("p")).toHaveCSS("white-space", "nowrap");
  await page.getByRole("button", { name: "View", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "AI generated response", exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.locator('[tabindex="0"]')).toHaveText(generated(2));
  await expect(modal.getByRole("textbox")).toHaveCount(0);
  await modal.getByRole("button", { name: "Use generated text in editor" }).click();
  await expect(editor).toHaveValue(generated(2)); await expect(modal).not.toBeVisible();
  await editor.fill(" \n"); await regenerate.click(); await expect(editor).toHaveValue(generated(3));
  await expect(page.getByRole("button", { name: "View", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Send reviewed response" }).click();
  await expect(editor).toHaveValue(""); await regenerate.click(); await expect(editor).toHaveValue(generated(4));
  await editor.fill(""); holdNext = true; release = undefined; await regenerate.click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await editor.fill("Typed while AI was generating"); release!();
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
  await expect(editor).toHaveValue("Typed while AI was generating");
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(modal).toBeVisible(); await page.keyboard.press("Escape"); await expect(modal).not.toBeVisible();
  holdNext = true; release = undefined; await regenerate.click();
  await expect.poll(() => Boolean(release)).toBe(true); await editor.fill(""); release!();
  await expect(editor).toHaveValue(generated(6));
  assert.equal(draftCalls, 6);
  console.log("PASS: empty/after-send autofill, whitespace handling, non-empty edit protection, one-line preview, read-only modal, explicit replacement, Escape, and typing/clearing during generation. All draft/message APIs intercepted; no AI calls or ticket writes.");
} catch {
  console.error("Composer browser check failed. Check the local app, configured admin login, CA trust and installed Edge; no credentials printed.");
  process.exitCode = 1;
} finally { await browser?.close(); }
