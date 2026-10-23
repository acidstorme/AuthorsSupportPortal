import type { SourceAuthor, SourceData } from "./source";

export type DemoIdentity = { kind: "AUTHOR" | "ADMIN"; sourceId: string; email: string; displayName: string; author?: SourceAuthor };
export type AuthIdentity = { id: string; email?: string; email_confirmed_at?: string; app_metadata: Record<string, unknown> };
export type StoredIdentity = { id: string; loginEmail: string; role: "AUTHOR" | "ADMIN"; authorProfile: { authorId: string; email: string } | null };
export interface ProvisioningAuth {
  list(): Promise<AuthIdentity[]>;
  create(identity: DemoIdentity, password: string, projectRef: string): Promise<AuthIdentity>;
}
export interface ProvisioningStore {
  list(): Promise<StoredIdentity[]>;
  books(): Promise<{ bookId: string; authorId: string }[]>;
  save(identity: DemoIdentity, authId: string): Promise<void>;
}

export function desiredIdentities(data: SourceData, admin1: string, admin2: string): DemoIdentity[] {
  const result: DemoIdentity[] = data.authors.map((author) => ({ kind: "AUTHOR", sourceId: author.author_id, email: author.email, displayName: author.name, author }));
  result.push({ kind: "ADMIN", sourceId: "ADMIN1", email: admin1, displayName: "Demo Administrator 1" }, { kind: "ADMIN", sourceId: "ADMIN2", email: admin2, displayName: "Demo Administrator 2" });
  if (new Set(result.map((identity) => identity.email.toLowerCase())).size !== 12) throw new Error("Administrator and author emails must all be distinct.");
  return result;
}

export function marker(identity: DemoIdentity, projectRef: string) {
  return { version: 1, projectRef, kind: identity.kind, sourceId: identity.sourceId };
}

export function assertAuthIdentity(account: AuthIdentity, identity: DemoIdentity, projectRef: string) {
  const actual = account.app_metadata.bookleaf_demo as Record<string, unknown> | undefined;
  const expected = marker(identity, projectRef);
  if (account.email?.toLowerCase() !== identity.email.toLowerCase() || !account.email_confirmed_at || !actual || Object.entries(expected).some(([key, value]) => actual[key] !== value)) {
    throw new Error(`${identity.sourceId}: existing Auth identity is unconfirmed or lacks the exact trusted demo marker. Do not adopt it by email; use a clean isolated project or investigate with its owner.`);
  }
}

export function assertStoredIdentity(user: StoredIdentity, identity: DemoIdentity, authId: string) {
  if (user.id !== authId || user.loginEmail !== identity.email.toLowerCase() || user.role !== identity.kind ||
    (identity.kind === "ADMIN" && user.authorProfile !== null) ||
    (identity.kind === "AUTHOR" && user.authorProfile && (user.authorProfile.authorId !== identity.sourceId || user.authorProfile.email !== identity.email))) {
    throw new Error(`${identity.sourceId}: conflicting email, UUID, role or author mapping. No role promotion or reassignment is permitted.`);
  }
}

export async function preflightInventory(all: DemoIdentity[], auth: ProvisioningAuth, store: ProvisioningStore, projectRef: string) {
  const [accounts, users, books] = await Promise.all([auth.list(), store.list(), store.books()]);
  const byEmail = new Map<string, AuthIdentity>();
  for (const account of accounts) {
    const identity = all.find((item) => item.email.toLowerCase() === account.email?.toLowerCase());
    if (!identity) throw new Error("Unexpected Auth account in the isolated project. Stop and use a dedicated project; no account will be deleted.");
    assertAuthIdentity(account, identity, projectRef);
    if (byEmail.has(identity.email.toLowerCase())) throw new Error("Duplicate case-insensitive Auth email mapping.");
    byEmail.set(identity.email.toLowerCase(), account);
  }
  for (const user of users) {
    const identity = all.find((item) => item.email.toLowerCase() === user.loginEmail);
    const account = identity && byEmail.get(identity.email.toLowerCase());
    if (!identity || !account) throw new Error("Unexpected application user or missing Auth mapping. Setup stopped without deleting data.");
    assertStoredIdentity(user, identity, account.id);
  }
  const desiredBooks = all.flatMap((identity) => identity.author?.books.map((book) => ({ bookId: book.book_id, authorId: identity.sourceId })) ?? []);
  for (const book of books) {
    if (!desiredBooks.some((expected) => book.bookId === expected.bookId && book.authorId === expected.authorId)) throw new Error("Conflicting or unexpected book ownership. Setup will not reassign or delete books.");
  }
  return byEmail;
}

export async function provisionAccounts(options: { all: DemoIdentity[]; kind: "AUTHOR" | "ADMIN"; password: string; projectRef: string; auth: ProvisioningAuth; store: ProvisioningStore }) {
  const { all, kind, password, projectRef, auth, store } = options;
  const known = await preflightInventory(all, auth, store, projectRef);
  let created = 0;
  let reused = 0;
  for (const identity of all.filter((item) => item.kind === kind)) {
    let account = known.get(identity.email.toLowerCase());
    if (!account) {
      account = await auth.create(identity, password, projectRef);
      assertAuthIdentity(account, identity, projectRef);
      known.set(identity.email.toLowerCase(), account);
      created++;
    } else reused++;
    // Auth succeeds first; its trusted marker permits safe recovery if this DB step fails.
    await store.save(identity, account.id);
  }
  const saved = await store.list();
  for (const identity of all.filter((item) => item.kind === kind)) {
    const account = known.get(identity.email.toLowerCase())!;
    const user = saved.find((item) => item.id === account.id);
    if (!user || (kind === "AUTHOR" && !user.authorProfile)) throw new Error(`${identity.sourceId}: application mapping was not persisted.`);
    assertStoredIdentity(user, identity, account.id);
  }
  return { created, reused, total: all.filter((item) => item.kind === kind).length };
}
