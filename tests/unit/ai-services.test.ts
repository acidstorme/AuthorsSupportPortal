import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ticket } from "../../src/generated/prisma/client";
import type { Principal } from "../../src/server/auth/policy";
import type { AIRepository, AISnapshot } from "../../src/server/repositories/ai";
import { classifyPersistedTicket, retryClassification, draftTicket, contextFingerprint } from "../../src/server/services/ai";
import { mockProvider } from "../../src/server/ai/providers";
import type { AIProvider } from "../../src/server/ai/contracts";
const admin = { id: "admin", role: "ADMIN" } as Principal;
const author = { id: "author", role: "AUTHOR" } as Principal;
function snapshot(): AISnapshot {
  return { ticket: { id: "ticket", status: "OPEN", draftText: null, draftContextHash: null, draftProvider: null, draftModel: null, draftGeneratedAt: null } as Ticket,
    context: { subject: "Royalty payout", description: "Six months without payment", ticketStatus: "OPEN", book: { status: "In Production", publicationDate: null, royaltyPending: "500.00" }, category: null, priority: null, messages: [], omittedMessages: 0 } };
}
const repo = { load: vi.fn(), claim: vi.fn(), finishClassification: vi.fn(), finishDraft: vi.fn() } satisfies AIRepository;
const provider = { ...mockProvider, classify: vi.fn(), draft: vi.fn() } satisfies AIProvider;
beforeEach(() => { vi.resetAllMocks(); repo.load.mockResolvedValue(snapshot()); repo.claim.mockResolvedValue(true); repo.finishClassification.mockResolvedValue(true); repo.finishDraft.mockResolvedValue(true); provider.classify.mockResolvedValue({ category: "ROYALTY_PAYMENTS", priority: "CRITICAL" }); provider.draft.mockResolvedValue("Please share the period so the team can review it."); });
describe("AI application services", () => {
  it("classifies persisted context and saves only validated AI fields/provenance", async () => {
    const result = await classifyPersistedTicket("ticket", repo, () => provider);
    expect(repo.load.mock.invocationCallOrder[0]).toBeLessThan(repo.claim.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ status: "SUCCEEDED", provider: "MOCK", priority: "CRITICAL" });
    expect(repo.finishClassification).toHaveBeenCalledWith("ticket", expect.any(Date), provider, { category: "ROYALTY_PAYMENTS", priority: "CRITICAL" }, null);
  });
  it("persists sanitized failure for unavailable provider or bad configuration", async () => {
    for (const factory of [() => { throw new Error("secret-key"); }, () => provider]) {
      provider.classify.mockRejectedValue(new Error("secret-provider-body"));
      await expect(classifyPersistedTicket("ticket", repo, factory)).rejects.toMatchObject({ status: 503, code: "AI_UNAVAILABLE" });
      expect(repo.finishClassification.mock.calls.at(-1)?.[4]).toBe("PROVIDER_UNAVAILABLE");
    }
  });
  it("rejects invalid classification outputs and stale completions", async () => {
    provider.classify.mockResolvedValue({ category: "invented", priority: "URGENT" });
    await expect(classifyPersistedTicket("ticket", repo, () => provider)).rejects.toMatchObject({ status: 503 });
    provider.classify.mockResolvedValue({ category: "GENERAL_INQUIRY", priority: "LOW" }); repo.finishClassification.mockResolvedValue(false);
    await expect(classifyPersistedTicket("ticket", repo, () => provider)).rejects.toMatchObject({ code: "AI_STALE" });
  });
  it("requires ADMIN for retry/draft before reading tickets", async () => {
    await expect(retryClassification(author, "ticket", repo, () => provider)).rejects.toMatchObject({ status: 403 });
    await expect(draftTicket(author, "ticket", false, repo, () => provider)).rejects.toMatchObject({ status: 403 });
    expect(repo.load).not.toHaveBeenCalled();
  });
  it("deduplicates running/cooldown work without provider calls", async () => {
    repo.claim.mockResolvedValue(false);
    await expect(classifyPersistedTicket("ticket", repo, () => provider)).rejects.toMatchObject({ status: 429 });
    await expect(draftTicket(admin, "ticket", false, repo, () => provider)).rejects.toMatchObject({ status: 429 });
    expect(provider.classify).not.toHaveBeenCalled(); expect(provider.draft).not.toHaveBeenCalled();
  });
  it("generates a draft but never sends a public message", async () => {
    const result = await draftTicket(admin, "ticket", false, repo, () => provider);
    expect(result).toMatchObject({ provider: "MOCK", stale: false, cached: false });
    expect(repo.finishDraft).toHaveBeenCalledWith("ticket", expect.any(Date), provider, expect.stringMatching(/^[a-f0-9]{64}$/), result.text, null, expect.any(Date));
    expect(result.generatedAt).toBe(repo.finishDraft.mock.calls[0][6].toISOString());
  });
  it("returns persisted cache without another claim or generation", async () => {
    const saved = snapshot(); saved.ticket.draftText = "Saved"; saved.ticket.draftContextHash = contextFingerprint(saved, provider); saved.ticket.draftProvider = "MOCK";
    repo.load.mockResolvedValue(saved);
    expect(await draftTicket(admin, "ticket", false, repo, () => provider)).toMatchObject({ text: "Saved", cached: true, stale: false });
    expect(repo.claim).not.toHaveBeenCalled(); expect(provider.draft).not.toHaveBeenCalled();
  });
  it("returns stale cache without automatically discarding edits or paying for regeneration", async () => {
    const saved = snapshot(); saved.ticket.draftText = "Old"; saved.ticket.draftContextHash = "old"; repo.load.mockResolvedValue(saved);
    expect(await draftTicket(admin, "ticket", false, repo, () => provider)).toMatchObject({ stale: true, text: "Old" });
    expect(provider.draft).not.toHaveBeenCalled();
    expect((await draftTicket(admin, "ticket", true, repo, () => provider)).cached).toBe(false); expect(provider.draft).toHaveBeenCalledOnce();
  });
  it("fingerprints book, messages, status, effective classification and mode/model changes", () => {
    const base = snapshot(); const hash = contextFingerprint(base, provider);
    for (const context of [{ ...base.context, priority: "HIGH" }, { ...base.context, ticketStatus: "RESOLVED" }, { ...base.context, omittedMessages: 1 }, { ...base.context, book: null }]) expect(contextFingerprint({ ...base, context }, provider)).not.toBe(hash);
    expect(contextFingerprint(base, { kind: "OPENAI", model: provider.model })).not.toBe(hash);
    expect(contextFingerprint(base, { ...provider, model: "changed" })).not.toBe(hash);
  });
  it("does not cache a draft if the conversation changes while generating", async () => {
    repo.load.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce({ ...snapshot(), context: { ...snapshot().context, messages: [{ id: "new", role: "AUTHOR", body: "New reply", createdAt: new Date().toISOString() }] } });
    await expect(draftTicket(admin, "ticket", false, repo, () => provider)).rejects.toMatchObject({ code: "DRAFT_CONTEXT_CHANGED" });
    expect(repo.finishDraft.mock.calls[0][4]).toBeNull();
  });
  it("keeps manual composer available on failure and rejects closed tickets", async () => {
    provider.draft.mockRejectedValue(new Error("private details"));
    await expect(draftTicket(admin, "ticket", false, repo, () => provider)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("manually") });
    const closed = snapshot(); closed.ticket.status = "CLOSED"; repo.load.mockResolvedValue(closed);
    await expect(draftTicket(admin, "ticket", false, repo, () => provider)).rejects.toMatchObject({ code: "TICKET_CLOSED" });
  });
});
