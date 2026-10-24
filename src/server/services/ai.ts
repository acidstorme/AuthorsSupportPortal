import { createHash } from "node:crypto";
import { requireRole, type Principal } from "../auth/policy";
import { AppError } from "../http/errors";
import type { AIRepository, AISnapshot } from "../repositories/ai";
import { classificationSchema, PROMPT_VERSION, type AIProvider } from "../ai/contracts";
import { KB_VERSION } from "../ai/knowledge-base";
import { safeAIError } from "../ai/providers";
import type { DraftDto } from "@/shared/contracts/ai";
type Factory = () => AIProvider;
export function contextFingerprint(snapshot: AISnapshot, provider: Pick<AIProvider, "kind" | "model">) {
  return createHash("sha256").update(JSON.stringify({ context: snapshot.context, provider: provider.kind, model: provider.model, prompt: PROMPT_VERSION, kb: KB_VERSION })).digest("hex");
}
export async function classifyPersistedTicket(id: string, repo: AIRepository, factory: Factory) {
  const snapshot = await repo.load(id);
  if (!snapshot) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
  const started = new Date();
  if (!await repo.claim(id, "classification", started)) throw new AppError(429, "AI_COOLDOWN", "Classification is running or was attempted recently. Retry after 30 seconds.");
  let provider: AIProvider | null = null;
  try {
    provider = factory();
    const result = classificationSchema.parse(await provider.classify(snapshot.context));
    if (!await repo.finishClassification(id, started, provider, result, null)) throw new AppError(409, "AI_STALE", "A newer classification attempt superseded this result.");
    return { status: "SUCCEEDED", provider: provider.kind, model: provider.model, ...result };
  } catch (error) {
    if (error instanceof AppError && error.code === "AI_STALE") throw error;
    const code = safeAIError(error);
    await repo.finishClassification(id, started, provider, null, code);
    throw new AppError(503, "AI_UNAVAILABLE", "Classification failed. The ticket is saved and can be triaged manually.");
  }
}
export async function retryClassification(principal: Principal, id: string, repo: AIRepository, factory: Factory) {
  requireRole(principal, "ADMIN"); return classifyPersistedTicket(id, repo, factory);
}
export async function draftTicket(principal: Principal, id: string, regenerate: boolean, repo: AIRepository, factory: Factory): Promise<DraftDto> {
  requireRole(principal, "ADMIN");
  const snapshot = await repo.load(id);
  if (!snapshot) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
  if (snapshot.ticket.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "Reopen the ticket before drafting a response.");
  let provider: AIProvider;
  try { provider = factory(); } catch { throw new AppError(503, "AI_UNAVAILABLE", "AI is unavailable. You can write and send a response manually."); }
  const hash = contextFingerprint(snapshot, provider);
  const ticket = snapshot.ticket;
  if (ticket.draftText && !regenerate) return { text: ticket.draftText, provider: ticket.draftProvider, model: ticket.draftModel,
    generatedAt: ticket.draftGeneratedAt?.toISOString() ?? null, stale: ticket.draftContextHash !== hash, cached: true };
  const started = new Date();
  if (!await repo.claim(id, "draft", started)) throw new AppError(429, "AI_COOLDOWN", "Draft generation is running or was attempted recently. Retry after 30 seconds.");
  try {
    const text = (await provider.draft(snapshot.context)).trim();
    if (!text || text.length > 8000) throw new Error("Invalid draft");
    const current = await repo.load(id);
    if (!current || contextFingerprint(current, provider) !== hash || current.ticket.status === "CLOSED") throw new AppError(409, "DRAFT_CONTEXT_CHANGED", "Ticket context changed. Review the latest conversation and explicitly regenerate.");
    const completedAt = new Date();
    if (!await repo.finishDraft(id, started, provider, hash, text, null, completedAt)) throw new AppError(409, "AI_STALE", "A newer draft attempt superseded this result.");
    return { text, provider: provider.kind, model: provider.model, generatedAt: completedAt.toISOString(), stale: false, cached: false };
  } catch (error) {
    await repo.finishDraft(id, started, provider, hash, null, safeAIError(error));
    if (error instanceof AppError) throw error;
    throw new AppError(503, "AI_UNAVAILABLE", "Draft generation failed. You can write and send a response manually.");
  }
}
