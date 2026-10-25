import { describe, expect, it } from "vitest";
import { auditDetails, auditTitle } from "../../src/features/tickets/audit-history";

describe("audit history presentation", () => {
  it("keeps message, note and acknowledgement events to their heading", () => {
    for (const type of ["MESSAGE_ADDED", "NOTE_ADDED", "AUTHOR_REPLY_ACKNOWLEDGED"]) {
      expect(auditTitle(type)).toBe(type);
      expect(auditDetails(type, { messageId: "internal", noteId: "internal", replyAt: "timestamp", body: "private" })).toEqual([]);
    }
  });
  it("shows readable status, priority and manual override transitions", () => {
    expect(auditDetails("STATUS_CHANGED", { from: "OPEN", to: "IN_PROGRESS" })).toEqual(["Open → In progress"]);
    expect(auditDetails("PRIORITY_CHANGED", { from: "LOW", to: "HIGH" })).toEqual(["Low → High"]);
    expect(auditDetails("MANUAL_CLASSIFICATION_CHANGED", { manualCategory: { from: null, to: "ROYALTY_PAYMENTS" }, manualPriority: { from: "HIGH", to: null } })).toEqual(["Category: Automatic (AI) → Royalty & Payments", "Priority: High → Automatic (AI)"]);
  });
  it("shows assignment names without leaking IDs", () => {
    expect(auditDetails("ASSIGNMENT_CHANGED", { from: null, to: "id", toName: "Admin A" })).toEqual(["Unassigned → Admin A"]);
    expect(auditDetails("ASSIGNMENT_CHANGED", { from: "a", fromName: "Admin A", to: "b", toName: "Admin B" })).toEqual(["Admin A → Admin B"]);
    expect(auditDetails("ASSIGNMENT_CHANGED", { from: "a", fromName: "Admin A", to: null })).toEqual(["Admin A → Unassigned"]);
    expect(auditDetails("ASSIGNMENT_CHANGED", { from: "deleted-id", to: null })).toEqual(["Former administrator → Unassigned"]);
  });
  it("presents AI results and failures as labeled text", () => {
    expect(auditDetails("AI_CLASSIFICATION_SUCCEEDED", { category: "PRINTING_QUALITY", priority: "CRITICAL", provider: "OPENAI" })).toEqual(["Category: Printing & Quality", "Priority: Critical", "Provider: OpenAI"]);
    expect(auditDetails("AI_CLASSIFICATION_FAILED", { errorCode: "PROVIDER_UNAVAILABLE" })).toEqual(["AI classification failed: Provider unavailable."]);
  });
  it("handles missing, malformed and unknown metadata without displaying JSON", () => {
    for (const metadata of [null, [], "raw", { unexpected: { secret: "hidden" } }]) {
      expect(auditDetails("STATUS_CHANGED", metadata)).toEqual([]);
      expect(auditDetails("UNKNOWN_EVENT", metadata)).toEqual([]);
    }
    expect(auditTitle("CREATED")).toBe("Ticket created");
  });
});
