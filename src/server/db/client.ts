import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getCoreServerEnv } from "@/server/config/env";
import { createDatabaseConfig } from "./tls";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!globalForPrisma.prisma) {
    const env = getCoreServerEnv();
    const { config, diagnostics } = createDatabaseConfig(env.DATABASE_URL, env.DATABASE_CA_CERT);
    // Public certificate metadata only: never log URLs, credentials or query data.
    console.info(JSON.stringify(diagnostics));
    const adapter = new PrismaPg(config, { schema: "app" });
    globalForPrisma.prisma = new PrismaClient({ adapter, log: ["error"] });
  }
  return globalForPrisma.prisma;
}
