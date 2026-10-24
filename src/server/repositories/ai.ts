import "server-only";
import type { Ticket } from "@/generated/prisma/client";
import { getDb } from "../db/client";
import { bookDto } from "../services/books";
import type { AIContext, AIProvider, Classification } from "../ai/contracts";
import { PROMPT_VERSION } from "../ai/contracts";
export type AISnapshot = { ticket: Ticket; context: AIContext };
type Provenance = Pick<AIProvider, "kind" | "model">;
export interface AIRepository {
  load(id: string): Promise<AISnapshot | null>;
  claim(id: string, task: "classification" | "draft", started: Date): Promise<boolean>;
  finishClassification(id: string, started: Date, provider: Provenance | null, result: Classification | null, error: string | null): Promise<boolean>;
  finishDraft(id: string, started: Date, provider: Provenance | null, hash: string, text: string | null, error: string | null, completedAt?: Date): Promise<boolean>;
}
export const aiRepository: AIRepository = {
  async load(id) {
    const result = await getDb().ticket.findUnique({ where: { id }, include: { book: true,
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 6, select: { id: true, body: true, createdAt: true, sender: { select: { role: true } } } }, _count: { select: { messages: true } } } });
    if (!result) return null;
    const book = result.book ? bookDto(result.book) : null;
    const facts = book ? { bookId: book.bookId, title: book.title, isbn: book.isbn, status: book.status, publicationDate: book.publicationDate,
      mrp: book.mrp, authorRoyaltyPerCopy: book.authorRoyaltyPerCopy, totalCopiesSold: book.totalCopiesSold, totalRoyaltyEarned: book.totalRoyaltyEarned,
      royaltyPaid: book.royaltyPaid, royaltyPending: book.royaltyPending, lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate, availableOn: book.availableOn } : null;
    return { ticket: result, context: { subject: result.subject, description: result.description, ticketStatus: result.status,
      category: result.manualCategory ?? result.aiCategory, priority: result.manualPriority ?? result.aiPriority, book: facts,
      messages: result.messages.reverse().map((m) => ({ id: m.id, role: m.sender.role, body: m.body.slice(0, 1000), bodyTruncated: m.body.length > 1000, createdAt: m.createdAt.toISOString() })),
      omittedMessages: Math.max(0, result._count.messages - result.messages.length) } };
  },
  async claim(id, task, started) {
    const stale = new Date(started.getTime() - 30000);
    const result = await getDb().ticket.updateMany({ where: { id, ...(task === "classification" ? { OR: [{ aiStartedAt: null }, { aiStartedAt: { lte: stale } }] } : { status: { not: "CLOSED" }, OR: [{ draftStartedAt: null }, { draftStartedAt: { lte: stale } }] }) },
      data: task === "classification" ? { aiStartedAt: started, aiStatus: "RUNNING", aiErrorCode: null } : { draftStartedAt: started, draftErrorCode: null } });
    return result.count === 1;
  },
  finishClassification(id, started, provider, result, error) {
    return getDb().$transaction(async (tx) => {
      const changed = await tx.ticket.updateMany({ where: { id, aiStartedAt: started, aiStatus: "RUNNING" }, data: {
        aiStatus: result ? "SUCCEEDED" : "FAILED", aiCompletedAt: new Date(), aiErrorCode: error,
        aiProvider: provider?.kind ?? null, aiModel: provider?.model ?? null, aiPromptVersion: PROMPT_VERSION,
        ...(result ? { aiCategory: result.category, aiPriority: result.priority } : {}),
      } });
      if (changed.count) await tx.ticketEvent.create({ data: { ticketId: id, type: result ? "AI_CLASSIFICATION_SUCCEEDED" : "AI_CLASSIFICATION_FAILED",
        metadata: result ? { category: result.category, priority: result.priority, provider: provider?.kind ?? null } : { errorCode: error } } });
      return changed.count === 1;
    });
  },
  async finishDraft(id, started, provider, hash, text, error, completedAt = new Date()) {
    const result = await getDb().ticket.updateMany({ where: { id, draftStartedAt: started }, data: text ? {
      draftText: text, draftContextHash: hash, draftGeneratedAt: completedAt, draftErrorCode: null, draftProvider: provider?.kind, draftModel: provider?.model, draftPromptVersion: PROMPT_VERSION,
    } : { draftErrorCode: error } });
    return result.count === 1;
  },
};
