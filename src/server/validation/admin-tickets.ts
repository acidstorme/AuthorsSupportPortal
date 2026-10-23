import { z } from "zod";
import { messageListSchema } from "./tickets";
export const categorySchema = z.enum(["ROYALTY_PAYMENTS", "ISBN_METADATA_ISSUES", "PRINTING_QUALITY", "DISTRIBUTION_AVAILABILITY", "BOOK_STATUS_PRODUCTION_UPDATES", "GENERAL_INQUIRY"]);
export const prioritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const statusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const adminQueueSchema = messageListSchema.extend({
  status: statusSchema.optional(), category: categorySchema.optional(), priority: prioritySchema.optional(),
  assignment: z.enum(["all", "mine", "unassigned"]).default("all"),
  attention: z.enum(["all", "unseen"]).default("all"),
  sort: z.enum(["created_desc", "updated_desc", "priority_desc"]).default("created_desc"),
  search: z.string().trim().max(200).optional(),
});
export const updateTicketSchema = z.strictObject({ status: statusSchema.optional(),
  manualCategory: categorySchema.nullable().optional(), manualPriority: prioritySchema.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, "Supply at least one change.");
export const noteSchema = z.strictObject({ body: z.string().trim().min(1).max(8000), requestId: z.uuid() });
export const acknowledgeSchema = z.strictObject({ observedReplyAt: z.iso.datetime({ offset: true }) });
export const emptySchema = z.strictObject({});
export type AdminQueue = z.infer<typeof adminQueueSchema>;
export type TicketUpdate = z.infer<typeof updateTicketSchema>;
