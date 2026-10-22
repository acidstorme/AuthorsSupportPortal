import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sampleDataSchema } from "../../src/server/validation/sample-data";

const raw = readFileSync(new URL("../../data/bookleaf-sample.json", import.meta.url));
const source = JSON.parse(raw.toString("utf8"));

describe("supplied dataset integrity", () => {
  it("retains the exact original file bytes", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe("34fd3b03f4b26e68b466a6364c3b7fe2f3884d3d7dc65134b67cac8e006b59f8");
  });
  it("validates all source fields without changing values", () => {
    expect(sampleDataSchema.parse(source)).toEqual(source);
  });
  it("preserves in-production nulls and empty distribution arrays", () => {
    const books = sampleDataSchema.parse(source).authors.flatMap((author) => author.books);
    expect(books.filter((book) => book.publication_date === null).map((book) => book.book_id)).toEqual(["BK013", "BK015"]);
    expect(books.find((book) => book.book_id === "BK013")).toMatchObject({ mrp: null, print_partner: null, available_on: [] });
  });
  it("rejects duplicate IDs and unknown data fields instead of silently dropping them", () => {
    const duplicate = structuredClone(source);
    duplicate.authors[1].books[0].book_id = "BK001";
    expect(() => sampleDataSchema.parse(duplicate)).toThrow();
    expect(() => sampleDataSchema.parse({ ...source, unexpected: true })).toThrow();
  });
});
