import "server-only";
import type { Ticket, TicketMessage } from "@/generated/prisma/client";
import { getDb } from "../db/client";
import { AppError } from "../http/errors";
import type { CreateTicket, MessageList, TicketList } from "../validation/tickets";

export type PublicMessage = TicketMessage & { sender: { displayName: string; role: "AUTHOR" | "ADMIN" } };
export interface TicketsRepository {
  list(authorId: string, query: TicketList): Promise<{ tickets: Ticket[]; total: number }>;
  find(id: string, authorId?: string): Promise<Ticket | null>;
  findCreation(authorId: string, requestId: string): Promise<Ticket | null>;
  ownsBook(bookId: string, authorId: string): Promise<boolean>;
  create(authorId: string, actorId: string, input: CreateTicket): Promise<Ticket>;
  messages(id: string, query: MessageList): Promise<{ messages: PublicMessage[]; total: number }>;
  reply(id: string, authorId: string | undefined, actorId: string, body: string, requestId: string): Promise<{ message: PublicMessage; replayed: boolean }>;
}
const sender = { select: { displayName: true, role: true } } as const;

export const ticketsRepository: TicketsRepository = {
  async list(authorId, query) {
    const db = getDb();
    const where = { authorId, ...(query.status ? { status: query.status } : {}) };
    const [tickets, total] = await db.$transaction([
      db.ticket.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        orderBy: query.sort === "updated_desc" ? [{ updatedAt: "desc" }, { id: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }] }),
      db.ticket.count({ where }),
    ]);
    return { tickets, total };
  },
  find: (id, authorId) => getDb().ticket.findFirst({ where: { id, ...(authorId ? { authorId } : {}) } }),
  findCreation: (authorId, creationRequestId) => getDb().ticket.findUnique({ where: { authorId_creationRequestId: { authorId, creationRequestId } } }),
  ownsBook: async (bookId, authorId) => Boolean(await getDb().book.findFirst({ where: { bookId, authorId }, select: { bookId: true } })),
  create(authorId, actorId, input) {
    return getDb().$transaction(async (tx) => {
      const ticket = await tx.ticket.create({ data: { authorId, bookId: input.bookId, subject: input.subject,
        description: input.description, creationRequestId: input.requestId } });
      await tx.ticketEvent.create({ data: { ticketId: ticket.id, actorId, type: "CREATED" } });
      return ticket;
    });
  },
  async messages(ticketId, query) {
    const [messages, total] = await getDb().$transaction([
      getDb().ticketMessage.findMany({ where: { ticketId }, include: { sender },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      getDb().ticketMessage.count({ where: { ticketId } }),
    ]);
    return { messages, total };
  },
  reply(id, authorId, actorId, body, requestId) {
    return getDb().$transaction(async (tx) => {
      // Admin status changes take this same lock before updating status.
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app.tickets WHERE id = ${id}::uuid FOR UPDATE`;
      const ticket = rows.length ? await tx.ticket.findFirst({ where: { id, ...(authorId ? { authorId } : {}) } }) : null;
      if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
      const previous = await tx.ticketMessage.findUnique({ where: { ticketId_senderId_clientRequestId: { ticketId: id, senderId: actorId, clientRequestId: requestId } }, include: { sender } });
      if (previous) {
        if (previous.body !== body) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Request ID was already used for different content.");
        return { message: previous, replayed: true };
      }
      if (ticket.status === "CLOSED") throw new AppError(409, "TICKET_CLOSED", "Closed tickets do not accept replies.");
      const message = await tx.ticketMessage.create({ data: { ticketId: id, senderId: actorId, body, clientRequestId: requestId }, include: { sender } });
      await tx.ticket.update({ where: { id }, data: { updatedAt: new Date(),
        ...(authorId && ticket.status === "RESOLVED" ? { resolvedAuthorReplyAt: message.createdAt } : {}) } });
      await tx.ticketEvent.create({ data: { ticketId: id, actorId, type: "MESSAGE_ADDED", metadata: { messageId: message.id } } });
      return { message, replayed: false };
    });
  },
};
