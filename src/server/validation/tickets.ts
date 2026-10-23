import { z } from "zod";

export const ticketIdSchema = z.uuid();
const body = z.string().trim().min(1).max(8000);
export const createTicketSchema = z.strictObject({
  subject: z.string().trim().min(1).max(200), description: body,
  bookId: z.string().trim().min(1).max(20).nullable().default(null), requestId: z.uuid(),
});
export const createMessageSchema = z.strictObject({ body, requestId: z.uuid() });
export const ticketListSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  sort: z.enum(["created_desc", "updated_desc"]).default("created_desc"),
});
export const messageListSchema = ticketListSchema.pick({ page: true, pageSize: true });
export type CreateTicket = z.infer<typeof createTicketSchema>;
export type CreateMessage = z.infer<typeof createMessageSchema>;
export type TicketList = z.infer<typeof ticketListSchema>;
export type MessageList = z.infer<typeof messageListSchema>;
