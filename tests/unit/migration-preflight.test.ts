import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrationChecksums } from "../../scripts/lib/preflight";

describe("cross-platform migration checksum checks", () => {
  it("accepts equivalent LF/CRLF scripts while preserving real checksum checks", () => {
    const lf = "BEGIN;\nCREATE SCHEMA app;\nCOMMIT;\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(migrationChecksums(lf)).toEqual(migrationChecksums(crlf));
    expect(migrationChecksums(lf).has(createHash("sha256").update(crlf).digest("hex"))).toBe(true);
  });
  it("rejects substantive SQL edits", () => {
    const checksum = createHash("sha256").update("CREATE SCHEMA other;\n").digest("hex");
    expect(migrationChecksums("CREATE SCHEMA app;\n").has(checksum)).toBe(false);
  });
});
