import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/server/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!globalForPrisma.prisma) {
    const env = getServerEnv();
    const adapter = new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    }, { schema: "app" });
    globalForPrisma.prisma = new PrismaClient({ adapter, log: ["error"] });
  }
  return globalForPrisma.prisma;
}
