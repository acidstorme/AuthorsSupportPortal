import type { AdminTicketDto, NoteDto, EventDto } from "@/shared/contracts/admin-tickets";
import { requireRole, type Principal } from "../auth/policy";
import { AppError } from "../http/errors";
import type { AdminCommand, AdminTicket, AdminTicketsRepository } from "../repositories/admin-tickets";
import type { AdminQueue } from "../validation/admin-tickets";
import type { MessageList } from "../validation/tickets";
import { ticketDto } from "./tickets";
export function adminTicketDto(ticket: AdminTicket): AdminTicketDto {
  return { ...ticketDto(ticket), author: ticket.author, book: ticket.book, assignedTo: ticket.assignedTo,
    manualCategory: ticket.manualCategory, manualPriority: ticket.manualPriority, aiCategory: ticket.aiCategory, aiPriority: ticket.aiPriority, aiStatus: ticket.aiStatus,
    aiProvider: ticket.aiProvider, aiModel: ticket.aiModel, aiErrorCode: ticket.aiErrorCode,
    resolvedAuthorReplyAt: ticket.resolvedAuthorReplyAt?.toISOString() ?? null,
    needsAttention: Boolean(ticket.resolvedAuthorReplyAt && (!ticket.authorReplySeenAt || ticket.resolvedAuthorReplyAt > ticket.authorReplySeenAt)) };
}
export async function adminQueue(principal: Principal, query: AdminQueue, repo: AdminTicketsRepository) {
  requireRole(principal, "ADMIN"); const result = await repo.queue(query, principal.id);
  return { data: result.tickets.map(adminTicketDto), meta: { page: query.page, pageSize: query.pageSize, total: result.total } };
}
export async function adminDetail(principal: Principal, id: string, repo: AdminTicketsRepository) {
  requireRole(principal, "ADMIN"); const ticket = await repo.find(id);
  if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found."); return adminTicketDto(ticket);
}
export async function adminMutation(principal: Principal, id: string, command: AdminCommand, repo: AdminTicketsRepository) {
  requireRole(principal, "ADMIN");
  if (command.kind === "assignment" && command.assignee !== null && command.assignee !== principal.id) throw new AppError(403, "FORBIDDEN", "Only self-assignment is supported.");
  return adminTicketDto(await repo.mutate(id, principal.id, command));
}
export async function adminHistory(principal: Principal, id: string, kind: "notes" | "events", query: MessageList, repo: AdminTicketsRepository) {
  await adminDetail(principal, id, repo);
  if (kind === "notes") {
    const result = await repo.notes(id, query);
    return { data: result.data.map((note): NoteDto => ({ id: note.id, body: note.body, creator: note.creator, createdAt: note.createdAt.toISOString() })), meta: { ...query, total: result.total } };
  }
  const result = await repo.events(id, query);
  return { data: result.data.map((event): EventDto => ({ id: event.id, type: event.type, actor: event.actor, metadata: event.metadata, createdAt: event.createdAt.toISOString() })), meta: { ...query, total: result.total } };
}
