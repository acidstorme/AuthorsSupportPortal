import type { AuthorProfile, Book, PrismaClient } from "../../src/generated/prisma/client";
import { assertStoredIdentity, preflightInventory, type DemoIdentity, type ProvisioningAuth, type ProvisioningStore } from "./provisioning";
import { bookFields, profileFields, type SourceData } from "./source";

function equalFields(actual: Record<string, unknown>, expected: Record<string, unknown>, label: string) {
  for (const [key, value] of Object.entries(expected)) {
    const stored = actual[key];
    const equal = stored && typeof stored === "object" && "equals" in stored && typeof stored.equals === "function"
      ? stored.equals(value)
      : JSON.stringify(stored) === JSON.stringify(value);
    if (!equal) throw new Error(`${label}: source field ${key} differs. Rerun the safe seed or investigate; do not rewrite the source JSON.`);
  }
}

export function verifySourceRows(data: SourceData, profiles: AuthorProfile[], books: Book[]) {
  if (profiles.length !== 10 || books.length !== 18) throw new Error("Expected exactly 10 author profiles and 18 books.");
  for (const author of data.authors) {
    const profile = profiles.find((item) => item.authorId === author.author_id);
    if (!profile) throw new Error(`${author.author_id}: missing source profile.`);
    equalFields(profile, profileFields(author), author.author_id);
    for (const book of author.books) {
      const row = books.find((item) => item.bookId === book.book_id);
      if (!row || row.authorId !== author.author_id) throw new Error(`${book.book_id}: missing book or incorrect owner.`);
      equalFields(row, bookFields(book), book.book_id);
    }
  }
}

export async function verifySetup(db: PrismaClient, data: SourceData, all: DemoIdentity[], auth: ProvisioningAuth, store: ProvisioningStore, projectRef: string) {
  const accounts = await preflightInventory(all, auth, store, projectRef);
  const [users, profiles, books] = await Promise.all([store.list(), db.authorProfile.findMany(), db.book.findMany()]);
  if (accounts.size !== 12 || users.length !== 12 || users.filter((user) => user.role === "AUTHOR").length !== 10 || users.filter((user) => user.role === "ADMIN").length !== 2) throw new Error("Expected exactly 12 Auth/application users: 10 AUTHOR and 2 ADMIN.");
  for (const identity of all) {
    const account = accounts.get(identity.email.toLowerCase());
    const user = users.find((row) => row.id === account?.id);
    if (!account || !user || (identity.kind === "AUTHOR" && !user.authorProfile)) throw new Error(`${identity.sourceId}: incomplete account/profile mapping.`);
    assertStoredIdentity(user, identity, account.id);
  }
  verifySourceRows(data, profiles, books);
  return { authAccounts: 12, applicationUsers: 12, authors: 10, admins: 2, books: 18, exactSourceData: true };
}
