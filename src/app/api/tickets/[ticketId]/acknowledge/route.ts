import { changeTicket, type TicketContext } from "@/server/http/admin-ticket-handlers";
export const runtime = "nodejs";
export function POST(request: Request, context: TicketContext) { return changeTicket(request, context, "acknowledge"); }
