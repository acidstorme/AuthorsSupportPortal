import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sampleDataSchema } from "../../src/server/validation/sample-data";
import type { z } from "zod";

export type SourceData = z.infer<typeof sampleDataSchema>;
export type SourceAuthor = SourceData["authors"][number];

export function loadSource(): SourceData {
  const raw = readFileSync(new URL("../../data/bookleaf-sample.json", import.meta.url));
  if (createHash("sha256").update(raw).digest("hex") !== "34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8") throw new Error("Source checksum mismatch. Restore the unchanged supplied JSON.");
  return sampleDataSchema.parse(JSON.parse(raw.toString("utf8")));
}

export function profileFields(author: SourceAuthor) {
  return { name: author.name, email: author.email, phone: author.phone, city: author.city, joinedDate: new Date(`${author.joined_date}T00:00:00.000Z`) };
}

export function bookFields(book: SourceAuthor["books"][number]) {
  return {
    title: book.title, isbn: book.isbn, genre: book.genre, status: book.status,
    publicationDate: book.publication_date ? new Date(`${book.publication_date}T00:00:00.000Z`) : null,
    mrp: book.mrp === null ? null : String(book.mrp),
    authorRoyaltyPerCopy: book.author_royalty_per_copy === null ? null : String(book.author_royalty_per_copy),
    totalCopiesSold: book.total_copies_sold, totalRoyaltyEarned: String(book.total_royalty_earned),
    royaltyPaid: String(book.royalty_paid), royaltyPending: String(book.royalty_pending),
    lastRoyaltyPayoutDate: book.last_royalty_payout_date ? new Date(`${book.last_royalty_payout_date}T00:00:00.000Z`) : null,
    printPartner: book.print_partner, availableOn: book.available_on,
  };
}
