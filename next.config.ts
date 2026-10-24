import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Public CA certificates may be referenced by sslrootcert in the runtime DB URL.
  outputFileTracingIncludes: { "/**": ["./certs/*.crt"] },
};

export default nextConfig;
