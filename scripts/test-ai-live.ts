import assert from "node:assert/strict";
import { loadProjectEnv } from "../src/server/config/load-env";
import { parseRuntimeEnv } from "../src/server/config/env-schema";
import { createOpenAIProvider } from "../src/server/ai/providers";
loadProjectEnv();
try {
  assert.equal(process.argv[2], "live", "Pass live explicitly; this command makes two paid model requests.");
  const env = parseRuntimeEnv({ ...process.env, AI_MODE: "openai" });
  const provider = createOpenAIProvider(env.OPENAI_API_KEY!, env.OPENAI_MODEL);
  const context = { subject: "My book has a wrong ISBN on the Amazon listing", description: "The ISBN on the listing differs from my physical copy. Please help.", ticketStatus: "OPEN", category: "ISBN_METADATA_ISSUES", priority: "HIGH", book: null, messages: [], omittedMessages: 0 };
  const classification = await provider.classify(context);
  assert.equal(classification.category, "ISBN_METADATA_ISSUES"); assert.ok(["HIGH", "CRITICAL"].includes(classification.priority));
  const draft = await provider.draft(context); assert.ok(draft.length > 20);
  console.log("Live provider smoke PASS:", { model: provider.model, classification, draftCharacters: draft.length });
  console.log("Synthetic draft for human grounding review:\n" + draft);
} catch {
  console.error("Live AI verification failed or is not configured. Check the configured model, account access/quota, key and network. No raw provider error or credentials printed.");
  process.exitCode = 1;
}
