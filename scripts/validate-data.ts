import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sampleDataSchema } from "../src/server/validation/sample-data";

const expectedHash = "34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8";
try {
  const raw = readFileSync(new URL("../data/bookleaf-sample.json", import.meta.url));
  const hash = createHash("sha256").update(raw).digest("hex");
  if (hash !== expectedHash) throw new Error("Source dataset checksum differs from the supplied file. Do not normalize or edit it.");
  const data = sampleDataSchema.parse(JSON.parse(raw.toString("utf8")));
  console.log(`Source data validated: ${data.authors.length} authors, ${data.authors.flatMap((author) => author.books).length} books. Exact source checksum matches.`);
  console.log("Exact email.com identities are explicitly approved for this isolated demo. Setup must verify the approved project and email-blocking acknowledgement.");
  console.log("No database writes or account provisioning were performed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Source validation failed.");
  process.exitCode = 1;
}
