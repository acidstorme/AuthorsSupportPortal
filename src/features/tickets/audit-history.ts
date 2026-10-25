import { ticketCategoryLabels } from "@/shared/ticket-labels";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function label(value: unknown, empty = "Not set"): string {
  if (typeof value !== "string" || !value) return empty;
  return ticketCategoryLabels[value as keyof typeof ticketCategoryLabels]
    ?? (/^[A-Z][A-Z_]*$/.test(value) ? value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : value);
}

export function auditDetails(type: string, metadata: unknown): string[] {
  const data = record(metadata);
  const transition = (value: Record<string, unknown>, empty?: string) => `${label(value.from, empty)} → ${label(value.to, empty)}`;
  switch (type) {
    case "STATUS_CHANGED":
    case "PRIORITY_CHANGED":
      return "from" in data && "to" in data ? [transition(data)] : [];
    case "ASSIGNMENT_CHANGED": {
      const name = (side: "from" | "to") => data[side] === null ? "Unassigned" : typeof data[`${side}Name`] === "string" ? data[`${side}Name`] : "Former administrator";
      return "from" in data && "to" in data ? [`${name("from")} → ${name("to")}`] : [];
    }
    case "MANUAL_CLASSIFICATION_CHANGED":
      return ([ ["manualCategory", "Category"], ["manualPriority", "Priority"] ] as const).flatMap(([key, title]) => {
        const change = record(data[key]);
        return "from" in change && "to" in change ? [`${title}: ${transition(change, "Automatic (AI)")}`] : [];
      });
    case "AI_CLASSIFICATION_SUCCEEDED":
      return [typeof data.category === "string" ? `Category: ${label(data.category)}` : null,
        typeof data.priority === "string" ? `Priority: ${label(data.priority)}` : null,
        data.provider === "MOCK" ? "Provider: Demo AI" : data.provider === "OPENAI" ? "Provider: OpenAI" : null,
      ].filter((line): line is string => line !== null);
    case "AI_CLASSIFICATION_FAILED":
      return [typeof data.errorCode === "string" ? `AI classification failed: ${label(data.errorCode)}.` : "AI classification could not be completed."];
    default:
      // Message/note IDs and acknowledgement timestamps are internal details.
      return [];
  }
}

export function auditTitle(type: string): string {
  if (["MESSAGE_ADDED", "NOTE_ADDED", "AUTHOR_REPLY_ACKNOWLEDGED"].includes(type)) return type;
  const titles: Record<string, string> = {
    CREATED: "Ticket created", STATUS_CHANGED: "Status changed", PRIORITY_CHANGED: "Priority changed",
    ASSIGNMENT_CHANGED: "Assignment changed", MANUAL_CLASSIFICATION_CHANGED: "Manual classification changed",
    AI_CLASSIFICATION_SUCCEEDED: "AI classification completed", AI_CLASSIFICATION_FAILED: "AI classification failed",
  };
  return titles[type] ?? label(type);
}
