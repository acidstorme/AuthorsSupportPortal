import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Explicit PrismaPg TLS trust fallback, including in Vercel server functions.
  outputFileTracingIncludes: { "/**": ["./certs/*.crt"] },
};

export default nextConfig;
