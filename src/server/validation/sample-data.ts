import { z } from "zod";

const money = z.number().nonnegative().finite().refine((n) => Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Expected at most two decimal places");
const bookSchema = z.strictObject({
  book_id: z.string().regex(/^BK\d{3}$/),
  title: z.string().min(1),
  isbn: z.string().min(1), // Supplied ISBNs intentionally contain X placeholders.
  genre: z.string().min(1),
  publication_date: z.iso.date().nullable(),
  status: z.string().min(1),
  mrp: money.nullable(),
  author_royalty_per_copy: money.nullable(),
  total_copies_sold: z.number().int().nonnegative(),
  total_royalty_earned: money,
  royalty_paid: money,
  royalty_pending: money,
  last_royalty_payout_date: z.iso.date().nullable(),
  print_partner: z.string().min(1).nullable(),
  available_on: z.array(z.string().min(1)),
});

export const sampleDataSchema = z.strictObject({
  authors: z.array(z.strictObject({
    author_id: z.string().regex(/^AUTH\d{3}$/),
    name: z.string().min(1),
    email: z.email(),
    phone: z.string().min(1),
    city: z.string().min(1),
    joined_date: z.iso.date(),
    books: z.array(bookSchema).min(1),
  })).length(10),
}).superRefine((data, ctx) => {
  const books = data.authors.flatMap((author) => author.books);
  if (books.length !== 18) ctx.addIssue({ code: "custom", message: "Expected exactly 18 source books" });
  if (new Set(data.authors.map((author) => author.author_id)).size !== 10) ctx.addIssue({ code: "custom", message: "Duplicate source author IDs" });
  if (new Set(books.map((book) => book.book_id)).size !== books.length) ctx.addIssue({ code: "custom", message: "Duplicate source book IDs" });
});
