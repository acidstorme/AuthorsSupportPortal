import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkServerIdentity } from "node:tls";
import type { PoolConfig } from "pg";

// Called only after core environment validation (project, role, schema, TLS).
export function createDatabaseConfig(databaseUrl: string, configuredCa?: string) {
  const url = new URL(databaseUrl);
  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Database TLS requires sslmode=verify-full.");
  }
  const caSource = configuredCa?.trim() ? "environment" : "bundled";
  const ca = caSource === "environment"
    ? configuredCa!.replace(/\\n/g, "\n").trim()
    : readFileSync(join(process.cwd(), "certs", "prod-ca-2021.crt"), "utf8");
  // Fail closed for an invalid trust anchor; never fall back to unverified TLS.
  const certificate = new X509Certificate(ca);
  if (!certificate.ca) throw new Error("Database trust certificate must be a CA.");

  // Do not pass connectionString: pg parses its SSL query parameters AFTER
  // explicit options, which would replace ssl.ca and verification settings.
  // schema is supplied separately to PrismaPg; URL query overrides are unused.
  const config: PoolConfig = {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { ca, rejectUnauthorized: true, checkServerIdentity, servername: url.hostname },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  };
  return {
    config,
    diagnostics: {
      event: "database_tls_configured",
      caSource,
      caFingerprint256: certificate.fingerprint256,
      verifyCertificate: true,
      verifyHostname: true,
    },
  };
}
