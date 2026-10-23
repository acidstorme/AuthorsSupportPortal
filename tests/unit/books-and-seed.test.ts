import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient, type Book } from "../../src/generated/prisma/client";
import { loadSource, profileFields, bookFields } from "../../scripts/lib/source";
import { seedSource } from "../../scripts/lib/seed";
import { verifySourceRows } from "../../scripts/lib/verify";
import { getBook, listBooks } from "../../src/server/services/books";
import type { BooksRepository } from "../../src/server/repositories/books";
import type { Principal } from "../../src/server/auth/policy";

const source = loadSource();
const author: Principal = { id: "uuid", email: source.authors[0].email, role: "AUTHOR", authorId: "AUTH001", displayName: source.authors[0].name };
function databaseBook(book: (typeof source.authors)[number]["books"][number], authorId: string): Book {
  return { bookId: book.book_id, authorId, ...bookFields(book),
    mrp: book.mrp === null ? null : new Prisma.Decimal(String(book.mrp)),
    authorRoyaltyPerCopy: book.author_royalty_per_copy === null ? null : new Prisma.Decimal(String(book.author_royalty_per_copy)),
    totalRoyaltyEarned: new Prisma.Decimal(String(book.total_royalty_earned)), royaltyPaid: new Prisma.Decimal(String(book.royalty_paid)), royaltyPending: new Prisma.Decimal(String(book.royalty_pending)), availableOn: [...book.available_on],
  };
}

describe("book ownership and transport", () => {
  it("uses trusted author scope for lists and detail queries", async () => {
    const book = databaseBook(source.authors[0].books[0], "AUTH001");
    const repository: BooksRepository = { list: vi.fn(async () => ({ books: [book], total: 1 })), findById: vi.fn(async () => null) };
    const result = await listBooks(author, { page: 1, pageSize: 20, sort: "title_asc" }, repository);
    expect(repository.list).toHaveBeenCalledWith({ authorId: "AUTH001", page: 1, pageSize: 20, sort: "title_asc" });
    expect(result.data[0]).toMatchObject({ mrp: "399.00", publicationDate: "2023-06-20", royaltyPending: "3570.00" });
    await expect(getBook(author, "BK003", repository)).rejects.toMatchObject({ status: 404 });
    expect(repository.findById).toHaveBeenCalledWith("BK003", "AUTH001");
    await expect(listBooks(author, { authorId: "AUTH002", page: 1, pageSize: 20, sort: "title_asc" }, repository)).rejects.toMatchObject({ status: 403 });
  });
  it("preserves production nulls and empty platform arrays in DTOs", async () => {
    const production = source.authors[6].books.find((book) => book.book_id === "BK013")!;
    const repository: BooksRepository = { list: vi.fn(), findById: vi.fn(async () => databaseBook(production, "AUTH007")) };
    expect(await getBook({ ...author, authorId: "AUTH007" }, "BK013", repository)).toMatchObject({ mrp: null, publicationDate: null, printPartner: null, availableOn: [] });
  });
});

describe("seed orchestration and exact round-trip checks (in-memory transaction adapter)", () => {
  function fixture() {
    const profiles = source.authors.map((item, index) => ({ authorId: item.author_id, userId: `uuid-${index}`, ...profileFields(item) }));
    const books = new Map<string, Book>();
    const ticketSentinel = { ticket: "keep", message: "keep", note: "keep", event: "keep" };
    const tx = {
      authorProfile: {
        findUnique: vi.fn(async ({ where }: { where: { authorId: string } }) => {
          const profile = profiles.find((item) => item.authorId === where.authorId);
          return profile ? { ...profile, user: { role: "AUTHOR", loginEmail: profile.email } } : null;
        }),
        update: vi.fn(async ({ where, data }: { where: { authorId: string }; data: object }) => Object.assign(profiles.find((item) => item.authorId === where.authorId)!, data)),
      },
      book: {
        findUnique: vi.fn(async ({ where }: { where: { bookId: string } }) => books.get(where.bookId) ?? null),
        upsert: vi.fn(async ({ create, update }: { create: Book; update: Partial<Book> }) => {
          const existing = books.get(create.bookId);
          const row = { ...(existing ?? create), ...update };
          const item = source.authors.flatMap((a) => a.books).find((b) => b.book_id === row.bookId)!;
          books.set(row.bookId, databaseBook(item, row.authorId));
        }),
      },
    };
    const db = { $transaction: vi.fn(async (action: (client: typeof tx) => Promise<void>) => action(tx)) } as unknown as PrismaClient;
    return { db, profiles, books, ticketSentinel, tx };
  }
  it("imports all eighteen books twice without duplication or touching ticket data", async () => {
    const f = fixture(); await seedSource(f.db, source); await seedSource(f.db, source);
    expect(f.books.size).toBe(18); expect(f.profiles).toHaveLength(10);
    expect(() => verifySourceRows(source, f.profiles, [...f.books.values()])).not.toThrow();
    expect(f.ticketSentinel).toEqual({ ticket: "keep", message: "keep", note: "keep", event: "keep" });
    expect(f.tx.book.upsert).toHaveBeenCalledTimes(36);
  });
  it("stops on existing cross-author books and detects modified source fields", async () => {
    const f = fixture(); f.books.set("BK001", databaseBook(source.authors[0].books[0], "AUTH002"));
    await expect(seedSource(f.db, source)).rejects.toThrow("refusing book reassignment");
    f.books.clear(); await seedSource(f.db, source);
    f.books.get("BK001")!.availableOn.reverse();
    expect(() => verifySourceRows(source, f.profiles, [...f.books.values()])).toThrow("availableOn differs");
  });
});
