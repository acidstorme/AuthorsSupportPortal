import "server-only";
import { Prisma, type Ticket, type TicketNote, type TicketEvent } from "@/generated/prisma/client";
import { getDb } from "../db/client";
import { AppError } from "../http/errors";
import type { AdminQueue, TicketUpdate } from "../validation/admin-tickets";
import type { MessageList } from "../validation/tickets";
export const adminInclude = { author: { select: { authorId: true, name: true, email: true } },
  book: { select: { bookId: true, title: true } }, assignedTo: { select: { id: true, displayName: true } } } as const;
export type AdminTicket = Ticket & { author: { authorId: string; name: string; email: string }; book: { bookId: string; title: string } | null; assignedTo: { id: string; displayName: string } | null };
type Note = TicketNote & { creator: { displayName: string } };
type Event = TicketEvent & { actor: { displayName: string } | null };
export type AdminCommand = { kind: "update"; input: TicketUpdate } | { kind: "assignment"; assignee: string | null } | { kind: "note"; body: string; requestId: string } | { kind: "acknowledge"; observedReplyAt: string };
export interface AdminTicketsRepository {
  queue(query: AdminQueue, actorId: string): Promise<{ tickets: AdminTicket[]; total: number }>;
  find(id: string): Promise<AdminTicket | null>;
  notes(id: string, query: MessageList): Promise<{ data: Note[]; total: number }>;
  events(id: string, query: MessageList): Promise<{ data: Event[]; total: number }>;
  mutate(id: string, actorId: string, command: AdminCommand): Promise<AdminTicket>;
}
const categoryLabels = { ROYALTY_PAYMENTS: "Royalty & Payments", ISBN_METADATA_ISSUES: "ISBN & Metadata Issues", PRINTING_QUALITY: "Printing & Quality", DISTRIBUTION_AVAILABILITY: "Distribution & Availability", BOOK_STATUS_PRODUCTION_UPDATES: "Book Status & Production Updates", GENERAL_INQUIRY: "General Inquiry" };
export const adminTicketsRepository: AdminTicketsRepository = {
  async queue(query, actorId) {
    const parts = [Prisma.sql`TRUE`];
    if (query.status) parts.push(Prisma.sql`t.status = ${query.status}::app."TicketStatus"`);
    if (query.unresolved === "only") parts.push(Prisma.sql`t.status IN ('OPEN'::app."TicketStatus", 'IN_PROGRESS'::app."TicketStatus")`);
    if (query.createdFrom) parts.push(Prisma.sql`t.created_at >= (${query.createdFrom}::date::timestamp AT TIME ZONE 'UTC')`);
    if (query.createdTo) parts.push(Prisma.sql`t.created_at < ((${query.createdTo}::date + INTERVAL '1 day') AT TIME ZONE 'UTC')`);
    if (query.category) parts.push(Prisma.sql`COALESCE(t.manual_category, t.ai_category) = ${categoryLabels[query.category]}::app."TicketCategory"`);
    if (query.priority) parts.push(Prisma.sql`COALESCE(t.manual_priority, t.ai_priority) = ${query.priority}::app."TicketPriority"`);
    if (query.assignment === "mine") parts.push(Prisma.sql`t.assigned_to_id = ${actorId}::uuid`);
    if (query.assignment === "unassigned") parts.push(Prisma.sql`t.assigned_to_id IS NULL`);
    if (query.attention === "unseen") parts.push(Prisma.sql`t.resolved_author_reply_at IS NOT NULL AND (t.author_reply_seen_at IS NULL OR t.resolved_author_reply_at > t.author_reply_seen_at)`);
    if (query.search) parts.push(Prisma.sql`(strpos(lower(t.subject), lower(${query.search})) > 0 OR strpos(lower(a.name), lower(${query.search})) > 0 OR strpos(lower(a.author_id), lower(${query.search})) > 0)`);
    const where = Prisma.join(parts, " AND ");
    // PostgreSQL enum order is CRITICAL, HIGH, MEDIUM, LOW; unclassified sorts last.
    const order = query.sort === "priority_desc" ? Prisma.sql`COALESCE(t.manual_priority, t.ai_priority) ASC NULLS LAST, t.created_at DESC, t.id DESC`
      : query.sort === "created_asc" ? Prisma.sql`t.created_at ASC, t.id ASC`
      : query.sort === "updated_desc" ? Prisma.sql`t.updated_at DESC, t.id DESC` : Prisma.sql`t.created_at DESC, t.id DESC`;
    return getDb().$transaction(async (tx) => {
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT t.id FROM app.tickets t JOIN app.author_profiles a ON a.author_id=t.author_id WHERE ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
      const counts = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM app.tickets t JOIN app.author_profiles a ON a.author_id=t.author_id WHERE ${where}`);
      const tickets = await tx.ticket.findMany({ where: { id: { in: ids.map((row) => row.id) } }, include: adminInclude });
      const map = new Map(tickets.map((ticket) => [ticket.id, ticket]));
      return { tickets: ids.map(({ id }) => map.get(id)!).filter(Boolean), total: Number(counts[0].total) };
    });
  },
  find: (id) => getDb().ticket.findUnique({ where: { id }, include: adminInclude }),
  async notes(ticketId, query) {
    const [data, total] = await getDb().$transaction([
      getDb().ticketNote.findMany({ where: { ticketId }, include: { creator: { select: { displayName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      getDb().ticketNote.count({ where: { ticketId } }),
    ]); return { data, total };
  },
  async events(ticketId, query) {
    const [data, total] = await getDb().$transaction([
      getDb().ticketEvent.findMany({ where: { ticketId }, include: { actor: { select: { displayName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      getDb().ticketEvent.count({ where: { ticketId } }),
    ]); return { data, total };
  },
  mutate(id, actorId, command) {
    return getDb().$transaction(async (tx) => {
      // Same row lock as public replies: close and reply serialize on this ticket only.
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app.tickets WHERE id = ${id}::uuid FOR UPDATE`;
      const ticket = rows.length ? await tx.ticket.findUnique({ where: { id } }) : null;
      if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
      const event = (type: TicketEvent["type"], metadata: Prisma.InputJsonObject) => tx.ticketEvent.create({ data: { ticketId: id, actorId, type, metadata } });
      const data: Prisma.TicketUncheckedUpdateInput = {};
      if (command.kind === "update") {
        const input = command.input;
        if (input.status !== undefined && input.status !== ticket.status) {
          data.status = input.status; await event("STATUS_CHANGED", { from: ticket.status, to: input.status });
        }
        const changes: Record<string, Prisma.InputJsonValue | null> = {};
        for (const key of ["manualCategory", "manualPriority"] as const) if (input[key] !== undefined && input[key] !== ticket[key]) {
          // These columns alone are updated; concurrent/future AI writes cannot erase overrides.
          if (key === "manualCategory") data.manualCategory = input.manualCategory;
          else data.manualPriority = input.manualPriority;
          changes[key] = { from: ticket[key], to: input[key]! };
        }
        if (Object.keys(changes).length) await event("MANUAL_CLASSIFICATION_CHANGED", changes);
      } else if (command.kind === "assignment") {
        if (command.assignee !== null && !await tx.user.findFirst({ where: { id: command.assignee, role: "ADMIN" }, select: { id: true } })) throw new AppError(422, "INVALID_ASSIGNEE", "Assignee must be an administrator.");
        if (ticket.assignedToId !== command.assignee) { data.assignedToId = command.assignee; await event("ASSIGNMENT_CHANGED", { from: ticket.assignedToId, to: command.assignee }); }
      } else if (command.kind === "note") {
        const previous = await tx.ticketNote.findUnique({ where: { id: command.requestId } });
        if (previous) {
          if (previous.ticketId !== id || previous.creatorId !== actorId || previous.body !== command.body) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Note request ID was already used for different content.");
        } else {
          const note = await tx.ticketNote.create({ data: { id: command.requestId, ticketId: id, creatorId: actorId, body: command.body } });
          data.updatedAt = new Date(); await event("NOTE_ADDED", { noteId: note.id });
        }
      } else {
        const observed = new Date(command.observedReplyAt);
        if (!ticket.resolvedAuthorReplyAt || observed.getTime() !== ticket.resolvedAuthorReplyAt.getTime()) throw new AppError(409, "ATTENTION_CHANGED", "The author reply changed. Refresh before acknowledging it.");
        if (!ticket.authorReplySeenAt || ticket.authorReplySeenAt < observed) { data.authorReplySeenAt = observed; await event("AUTHOR_REPLY_ACKNOWLEDGED", { replyAt: observed.toISOString() }); }
      }
      if (Object.keys(data).length) await tx.ticket.update({ where: { id }, data });
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: adminInclude });
    });
  },
};
