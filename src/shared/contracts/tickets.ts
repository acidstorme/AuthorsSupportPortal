export type TicketDto = {
  id: string; bookId: string | null; subject: string; description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category: "ROYALTY_PAYMENTS" | "ISBN_METADATA_ISSUES" | "PRINTING_QUALITY" | "DISTRIBUTION_AVAILABILITY" | "BOOK_STATUS_PRODUCTION_UPDATES" | "GENERAL_INQUIRY" | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  createdAt: string; updatedAt: string;
};
export type PublicMessageDto = {
  id: string; body: string; sender: { displayName: string; role: "AUTHOR" | "ADMIN" }; createdAt: string;
};
