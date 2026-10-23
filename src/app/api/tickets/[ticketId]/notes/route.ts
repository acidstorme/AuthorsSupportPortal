import { changeTicket, ticketHistory, type TicketContext } from "@/server/http/admin-ticket-handlers";
export const runtime = "nodejs";
export function GET(request: Request, context: TicketContext) { return ticketHistory(request, context, "notes"); }
export function POST(request: Request, context: TicketContext) { return changeTicket(request, context, "note"); }
