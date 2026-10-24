import { loadProjectEnv } from "../src/server/config/load-env";
import { getDb } from "../src/server/db/client";

loadProjectEnv();
const db = getDb();
try {
  const identity = await db.$queryRaw<Array<{ restricted: boolean }>>`
    SELECT current_user = 'bookleaf_runtime' AS restricted`;
  // A successful query through the mandatory verified-TLS pool confirms trust.
  // pg_stat_ssl would describe the pooler's backend, not this client's socket.
  if (!identity[0]?.restricted) throw new Error("Runtime identity verification failed.");
  const first = await db.user.findFirst({ select: { id: true } });
  if (!first) throw new Error("No seeded users available for login-query verification.");
  const found = await db.user.findUnique({ where: { id: first.id }, select: { id: true } });
  if (!found) throw new Error("Prisma login-query verification failed.");
  console.info(JSON.stringify({ event: "runtime_database_verified", restrictedRole: true, tls: true, prismaUserFindUnique: true, nodeEnv: process.env.NODE_ENV }));
} catch {
  // Raw driver exceptions can contain connection details; leave them out.
  console.error("Runtime database verification failed. Check CA, project, restricted credentials and connectivity.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
