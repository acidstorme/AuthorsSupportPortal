import nextEnv from "@next/env";

// Match Next.js .env precedence for Prisma and standalone scripts as well.
export function loadProjectEnv() {
  nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
}
