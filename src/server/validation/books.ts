import { z } from "zod";
export const bookIdSchema = z.string().regex(/^BK\d{3}$/);
export const bookQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  authorId: z.string().regex(/^AUTH\d{3}$/).optional(),
  sort: z.enum(["title_asc", "publication_date_desc"]).default("title_asc"),
});
