import "server-only";
import { getDb } from "../db/client";
import type { Book } from "@/generated/prisma/client";

export type BookList = { authorId?: string; page: number; pageSize: number; sort: "title_asc" | "publication_date_desc" };
export interface BooksRepository {
  list(query: BookList): Promise<{ books: Book[]; total: number }>;
  findById(bookId: string, authorId?: string): Promise<Book | null>;
}

export const booksRepository: BooksRepository = {
  async list(query) {
    const db = getDb();
    const where = query.authorId ? { authorId: query.authorId } : {};
    const [books, total] = await db.$transaction([
      db.book.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        orderBy: query.sort === "title_asc" ? [{ title: "asc" }, { bookId: "asc" }] : [{ publicationDate: { sort: "desc", nulls: "last" } }, { bookId: "asc" }] }),
      db.book.count({ where }),
    ]);
    return { books, total };
  },
  findById: (bookId, authorId) => getDb().book.findFirst({ where: { bookId, ...(authorId ? { authorId } : {}) } }),
};
