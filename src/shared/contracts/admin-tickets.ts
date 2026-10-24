import type { TicketDto } from "./tickets";
export type AdminTicketDto = TicketDto & {
  author: { authorId: string; name: string; email: string };
  book: { bookId: string; title: string } | null;
  assignedTo: { id: string; displayName: string } | null;
  manualCategory: TicketDto["category"]; manualPriority: TicketDto["priority"];
  aiCategory: TicketDto["category"]; aiPriority: TicketDto["priority"];
  aiStatus: string; aiProvider: "MOCK" | "OPENAI" | null; aiModel: string | null; aiErrorCode: string | null;
  needsAttention: boolean; resolvedAuthorReplyAt: string | null;
};
export type NoteDto = { id: string; body: string; creator: { displayName: string }; createdAt: string };
export type EventDto = { id: string; type: string; actor: { displayName: string } | null; metadata: unknown; createdAt: string };
