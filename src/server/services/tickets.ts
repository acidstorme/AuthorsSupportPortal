import type { Ticket } from "@/generated/prisma/client";
import type { TicketDto, PublicMessageDto } from "@/shared/contracts/tickets";
import { authorScope, requireRole, type Principal } from "../auth/policy";
import { AppError } from "../http/errors";
import type { PublicMessage, TicketsRepository } from "../repositories/tickets";
import type { CreateMessage, CreateTicket, MessageList, TicketList } from "../validation/tickets";

export function ticketDto(ticket: Ticket): TicketDto {
  return { id: ticket.id, bookId: ticket.bookId, subject: ticket.subject, description: ticket.description,
    status: ticket.status, category: ticket.manualCategory ?? ticket.aiCategory,
    priority: ticket.manualPriority ?? ticket.aiPriority,
    createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString() };
}
export function messageDto(message: PublicMessage): PublicMessageDto {
  return { id: message.id, body: message.body, sender: message.sender,
    createdAt: message.createdAt.toISOString() };
}
export async function listTickets(principal: Principal, query: TicketList, repo: TicketsRepository) {
  const authorId = authorScope(requireRole(principal, "AUTHOR"))!;
  const result = await repo.list(authorId, query);
  return { data: result.tickets.map(ticketDto), meta: { page: query.page, pageSize: query.pageSize, total: result.total } };
}
export async function getTicket(principal: Principal, id: string, repo: TicketsRepository) {
  const ticket = await repo.find(id, authorScope(principal));
  if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
  return ticketDto(ticket);
}
export async function createTicket(principal: Principal, input: CreateTicket, repo: TicketsRepository) {
  const authorId = authorScope(requireRole(principal, "AUTHOR"))!;
  const replay = (ticket: Ticket) => {
    if (ticket.subject !== input.subject || ticket.description !== input.description || ticket.bookId !== input.bookId) {
      throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Request ID was already used for different content.");
    }
    return { ticket: ticketDto(ticket), replayed: true };
  };
  const existing = await repo.findCreation(authorId, input.requestId);
  if (existing) return replay(existing);
  if (input.bookId && !await repo.ownsBook(input.bookId, authorId)) throw new AppError(422, "INVALID_BOOK", "Select one of your own books.");
  try { return { ticket: ticketDto(await repo.create(authorId, principal.id, input)), replayed: false }; }
  catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const winner = await repo.findCreation(authorId, input.requestId);
      if (winner) return replay(winner);
    }
    throw error;
  }
}
export async function listMessages(principal: Principal, id: string, query: MessageList, repo: TicketsRepository) {
  await getTicket(principal, id, repo);
  const result = await repo.messages(id, query);
  return { data: result.messages.map(messageDto), meta: { ...query, total: result.total } };
}
export async function replyToTicket(principal: Principal, id: string, input: CreateMessage, repo: TicketsRepository) {
  await getTicket(principal, id, repo);
  const result = await repo.reply(id, authorScope(principal), principal.id, input.body, input.requestId);
  return { message: messageDto(result.message), replayed: result.replayed };
}
