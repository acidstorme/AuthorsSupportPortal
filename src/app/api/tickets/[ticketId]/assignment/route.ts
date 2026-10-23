import { changeTicket, type TicketContext } from "@/server/http/admin-ticket-handlers";
export const runtime = "nodejs";
export function PUT(request: Request, context: TicketContext) { return changeTicket(request, context, "assign"); }
export function DELETE(request: Request, context: TicketContext) { return changeTicket(request, context, "unassign"); }
