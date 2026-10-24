import { readFileSync } from "node:fs";
import { checkServerIdentity } from "node:tls";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { createDatabaseConfig } from "../../src/server/db/tls";

const url = "postgresql://bookleaf_runtime.project:pass%40word@aws-0-test.pooler.supabase.com:6543/postgres?schema=app&sslmode=verify-full";
const ca = readFileSync("certs/prod-ca-2021.crt", "utf8");

describe("Prisma PostgreSQL TLS trust", () => {
  it("loads the bundled CA and preserves verification through pg parsing", () => {
    const { config, diagnostics } = createDatabaseConfig(url + "&sslrootcert=C%3A%2Fold-local-path.crt&ssl=no-verify");
    const client = new Client(config);
    expect(client.ssl).toMatchObject({ ca, rejectUnauthorized: true, checkServerIdentity, servername: config.host });
    expect(config).toMatchObject({ user: "bookleaf_runtime.project", password: "pass@word", port: 6543 });
    expect(config.connectionString).toBeUndefined();
    expect(diagnostics.caSource).toBe("bundled");
    expect(JSON.stringify(diagnostics)).not.toContain("pass");
  });

  it("accepts raw or escaped-newline environment PEM without losing verification", () => {
    for (const pem of [ca, ca.replace(/\n/g, "\\n")]) {
      const { config, diagnostics } = createDatabaseConfig(url, pem);
      expect(config.ssl).toMatchObject({ ca: ca.trim(), rejectUnauthorized: true });
      expect(diagnostics.caSource).toBe("environment");
    }
  });

  it("rejects a mismatched hostname", () => {
    const { config } = createDatabaseConfig(url);
    const ssl = config.ssl as Exclude<typeof config.ssl, boolean | undefined>;
    const cert = { subjectaltname: "DNS:expected.supabase.com" };
    expect(ssl.checkServerIdentity!("wrong.supabase.com", cert as never)).toHaveProperty("code", "ERR_TLS_CERT_ALTNAME_INVALID");
    expect(ssl.checkServerIdentity!("expected.supabase.com", cert as never)).toBeUndefined();
  });

  it("fails closed for invalid CA or weaker requested TLS", () => {
    expect(() => createDatabaseConfig(url, "invalid PEM")).toThrow();
    expect(() => createDatabaseConfig(url.replace("verify-full", "require"))).toThrow("verify-full");
  });
});
