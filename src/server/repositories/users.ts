import "server-only";
import { getDb } from "@/server/db/client";
import type { IdentityRepository } from "@/server/auth/policy";

export const usersRepository: IdentityRepository = {
  findById: (id) => getDb().user.findUnique({
    where: { id },
    select: { id: true, role: true, loginEmail: true, displayName: true, authorProfile: { select: { authorId: true } } },
  }),
};
