import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SourceData } from "./source";
import { bookFields, profileFields } from "./source";

export async function seedSource(db: PrismaClient, data: SourceData) {
  await db.$transaction(async (tx) => {
    for (const author of data.authors) {
      const profile = await tx.authorProfile.findUnique({ where: { authorId: author.author_id }, include: { user: true } });
      if (!profile || profile.email !== author.email || profile.user.role !== "AUTHOR" || profile.user.loginEmail !== author.email) throw new Error(`${author.author_id}: provision and verify its author identity before seeding.`);
      await tx.authorProfile.update({ where: { authorId: author.author_id }, data: profileFields(author) });
      for (const book of author.books) {
        const existing = await tx.book.findUnique({ where: { bookId: book.book_id }, select: { authorId: true } });
        if (existing && existing.authorId !== author.author_id) throw new Error(`${book.book_id}: conflicting owner; refusing book reassignment.`);
        await tx.book.upsert({ where: { bookId: book.book_id }, create: { bookId: book.book_id, authorId: author.author_id, ...bookFields(book) }, update: bookFields(book) });
      }
    }
  }, { isolationLevel: "Serializable", timeout: 30_000 });
  // This operation never deletes or writes tickets, messages, notes or audit events.
}
