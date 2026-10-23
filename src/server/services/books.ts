import type { Book } from "@/generated/prisma/client";
import { authorScope, type Principal } from "../auth/policy";
import { AppError } from "../http/errors";
import type { BookList, BooksRepository } from "../repositories/books";

export function bookDto(book: Book) {
  return {
    bookId: book.bookId, authorId: book.authorId, title: book.title, isbn: book.isbn,
    genre: book.genre, status: book.status, publicationDate: book.publicationDate?.toISOString().slice(0, 10) ?? null,
    mrp: book.mrp?.toFixed(2) ?? null, authorRoyaltyPerCopy: book.authorRoyaltyPerCopy?.toFixed(2) ?? null,
    totalCopiesSold: book.totalCopiesSold, totalRoyaltyEarned: book.totalRoyaltyEarned.toFixed(2),
    royaltyPaid: book.royaltyPaid.toFixed(2), royaltyPending: book.royaltyPending.toFixed(2),
    lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate?.toISOString().slice(0, 10) ?? null,
    printPartner: book.printPartner, availableOn: book.availableOn,
  };
}

export async function listBooks(principal: Principal, query: BookList, repository: BooksRepository) {
  const scope = authorScope(principal, query.authorId);
  const result = await repository.list({ ...query, authorId: scope });
  return { data: result.books.map(bookDto), meta: { page: query.page, pageSize: query.pageSize, total: result.total } };
}

export async function getBook(principal: Principal, bookId: string, repository: BooksRepository) {
  const book = await repository.findById(bookId, authorScope(principal));
  if (!book) throw new AppError(404, "NOT_FOUND", "Book not found.");
  return bookDto(book);
}
