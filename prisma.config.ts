import { defineConfig } from "prisma/config";
import { loadProjectEnv } from "./src/server/config/load-env";

loadProjectEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // No fake fallback connection: validate/generate/diff work offline; migrations need DIRECT_URL.
  datasource: { url: process.env.DIRECT_URL },
});
