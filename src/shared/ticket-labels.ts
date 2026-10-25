import type { TicketDto } from "@/shared/contracts/tickets";

export const ticketCategoryLabels: Record<NonNullable<TicketDto["category"]>, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA_ISSUES: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION_UPDATES: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};
