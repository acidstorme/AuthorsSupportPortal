import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { parseDemoEnv } from "../../src/server/config/env-schema";
import { assertStoredIdentity, marker, type AuthIdentity, type ProvisioningAuth, type ProvisioningStore } from "./provisioning";
import { profileFields } from "./source";

export function createSetupClients(env: ReturnType<typeof parseDemoEnv>) {
  // Privileged credentials are imported only by standalone scripts, never web modules.
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: options?.signal ?? AbortSignal.timeout(15_000) }) },
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DIRECT_URL, max: 1, connectionTimeoutMillis: 10_000 }, { schema: "app" }) });
  const auth: ProvisioningAuth = {
    async list() {
      const result: AuthIdentity[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error("Auth inventory unavailable. Check the approved project, provisioning key and network.");
        result.push(...data.users);
        if (data.users.length < 1000) return result;
      }
      throw new Error("Auth inventory exceeds this isolated demo's safe limit.");
    },
    async create(identity, password, projectRef) {
      const { data, error } = await client.auth.admin.createUser({ email: identity.email, password, email_confirm: true, app_metadata: { bookleaf_demo: marker(identity, projectRef) } });
      if (error || !data.user) throw new Error(`${identity.sourceId}: Auth creation failed. Rerun to reconcile a possibly completed request; existing credentials will not be changed.`);
      return data.user;
    },
  };
  const store: ProvisioningStore = {
    list: () => db.user.findMany({ select: { id: true, loginEmail: true, role: true, authorProfile: { select: { authorId: true, email: true } } } }),
    books: () => db.book.findMany({ select: { bookId: true, authorId: true } }),
    async save(identity, authId) {
      await db.$transaction(async (tx) => {
        const existing = await tx.user.findMany({ where: { OR: [{ id: authId }, { loginEmail: identity.email.toLowerCase() }] }, include: { authorProfile: true } });
        for (const user of existing) assertStoredIdentity(user, identity, authId);
        if (identity.author) {
          const profile = await tx.authorProfile.findUnique({ where: { authorId: identity.sourceId } });
          if (profile && (profile.userId !== authId || profile.email !== identity.email)) throw new Error(`${identity.sourceId}: author UUID/email conflict; refusing reassignment.`);
        }
        await tx.user.upsert({ where: { id: authId }, create: { id: authId, role: identity.kind, loginEmail: identity.email.toLowerCase(), displayName: identity.displayName }, update: { displayName: identity.displayName } });
        if (identity.author) await tx.authorProfile.upsert({ where: { authorId: identity.sourceId }, create: { authorId: identity.sourceId, userId: authId, ...profileFields(identity.author) }, update: profileFields(identity.author) });
      }, { isolationLevel: "Serializable" });
    },
  };
  return { db, auth, store };
}
