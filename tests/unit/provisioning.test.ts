import { describe, expect, it, vi } from "vitest";
import { loadSource } from "../../scripts/lib/source";
import { desiredIdentities, marker, provisionAccounts, type AuthIdentity, type StoredIdentity, type ProvisioningAuth, type ProvisioningStore } from "../../scripts/lib/provisioning";

const projectRef = "abcdefghijklmnopqrst";
const source = loadSource();
const all = desiredIdentities(source, "admin1@email.com", "admin2@email.com");

function fixture() {
  const accounts: AuthIdentity[] = [];
  const users: StoredIdentity[] = [];
  const auth: ProvisioningAuth = {
    list: vi.fn(async () => [...accounts]),
    create: vi.fn(async (identity, _password, project) => {
      const account = { id: `auth-${accounts.length + 1}`, email: identity.email, email_confirmed_at: "2026-10-23T00:00:00Z", app_metadata: { bookleaf_demo: marker(identity, project) } };
      accounts.push(account); return account;
    }),
  };
  const store: ProvisioningStore = {
    list: vi.fn(async () => [...users]), books: vi.fn(async () => []),
    save: vi.fn(async (identity, authId) => {
      const existing = users.find((user) => user.id === authId);
      if (!existing) users.push({ id: authId, loginEmail: identity.email.toLowerCase(), role: identity.kind, authorProfile: identity.kind === "AUTHOR" ? { authorId: identity.sourceId, email: identity.email } : null });
    }),
  };
  const provision = (kind: "AUTHOR" | "ADMIN", password = "fixture-password") => provisionAccounts({ all, kind, password, projectRef, auth, store });
  return { accounts, users, auth, store, provision };
}

describe("demo provisioning orchestration (in-memory adapters, not hosted integration)", () => {
  it("creates exactly ten source-email authors and two admins, with no admin profiles", async () => {
    const f = fixture();
    await expect(f.provision("AUTHOR")).resolves.toEqual({ created: 10, reused: 0, total: 10 });
    await expect(f.provision("ADMIN")).resolves.toEqual({ created: 2, reused: 0, total: 2 });
    expect(f.accounts.map((user) => user.email)).toEqual(all.map((identity) => identity.email));
    expect(f.users.filter((user) => user.role === "AUTHOR").map((user) => user.authorProfile?.authorId)).toEqual(source.authors.map((author) => author.author_id));
    expect(f.users.filter((user) => user.role === "ADMIN").every((user) => user.authorProfile === null)).toBe(true);
  });
  it("reruns without creating duplicates or changing existing passwords", async () => {
    const f = fixture();
    await f.provision("AUTHOR", "first-password"); await f.provision("ADMIN", "admin-password");
    await expect(f.provision("AUTHOR", "different-password")).resolves.toMatchObject({ created: 0, reused: 10 });
    await expect(f.provision("ADMIN", "different-admin-password")).resolves.toMatchObject({ created: 0, reused: 2 });
    expect(f.auth.create).toHaveBeenCalledTimes(12);
    expect(vi.mocked(f.auth.create).mock.calls.every((call) => call[1] !== "different-password" && call[1] !== "different-admin-password")).toBe(true);
    expect(f.users).toHaveLength(12);
  });
  it("recovers an Auth-created account after a database failure without resetting it", async () => {
    const f = fixture();
    vi.mocked(f.store.save).mockRejectedValueOnce(new Error("Simulated DB outage"));
    await expect(f.provision("AUTHOR")).rejects.toThrow("DB outage");
    expect(f.accounts).toHaveLength(1); expect(f.users).toHaveLength(0);
    await expect(f.provision("AUTHOR")).resolves.toMatchObject({ created: 9, reused: 1 });
    expect(f.accounts).toHaveLength(10); expect(f.users).toHaveLength(10);
  });
  it("rejects an unrelated account with a matching email before any writes", async () => {
    const f = fixture();
    f.accounts.push({ id: "unrelated", email: all[0].email, email_confirmed_at: "confirmed", app_metadata: {} });
    await expect(f.provision("AUTHOR")).rejects.toThrow("trusted demo marker");
    expect(f.auth.create).not.toHaveBeenCalled(); expect(f.store.save).not.toHaveBeenCalled();
  });
  it("rejects markers for a different project or source author", async () => {
    const f = fixture();
    f.accounts.push({ id: "other", email: all[0].email, email_confirmed_at: "confirmed", app_metadata: { bookleaf_demo: marker(all[1], projectRef) } });
    await expect(f.provision("AUTHOR")).rejects.toThrow("trusted demo marker");
    f.accounts[0].app_metadata.bookleaf_demo = marker(all[0], "xxxxxxxxxxxxxxxxxxxx");
    await expect(f.provision("AUTHOR")).rejects.toThrow("trusted demo marker");
  });
  it("never promotes an author to admin or reassigns an Auth UUID", async () => {
    const f = fixture(); await f.provision("AUTHOR"); await f.provision("ADMIN");
    f.users[10].role = "AUTHOR";
    await expect(f.provision("ADMIN")).rejects.toThrow("conflicting");
    f.users[10].role = "ADMIN"; f.users[0].id = "wrong-uuid";
    await expect(f.provision("AUTHOR")).rejects.toThrow("conflicting");
  });
  it("rejects admin profiles, conflicting profile IDs and cross-author book ownership", async () => {
    const f = fixture(); await f.provision("AUTHOR"); await f.provision("ADMIN");
    f.users[10].authorProfile = { authorId: "AUTH999", email: all[10].email };
    await expect(f.provision("ADMIN")).rejects.toThrow("conflicting");
    f.users[10].authorProfile = null;
    f.users[0].authorProfile!.authorId = "AUTH002";
    await expect(f.provision("AUTHOR")).rejects.toThrow("conflicting");
    f.users[0].authorProfile!.authorId = "AUTH001";
    vi.mocked(f.store.books).mockResolvedValue([{ bookId: "BK001", authorId: "AUTH002" }]);
    await expect(f.provision("AUTHOR")).rejects.toThrow("book ownership");
  });
  it("refuses unrelated extra accounts and duplicate admin emails", async () => {
    const f = fixture(); f.accounts.push({ id: "extra", email: "extra@example.invalid", app_metadata: {} });
    await expect(f.provision("AUTHOR")).rejects.toThrow("Unexpected Auth account");
    expect(() => desiredIdentities(source, all[0].email, "admin2@email.com")).toThrow("distinct");
  });
});
