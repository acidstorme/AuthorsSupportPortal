import { api, json } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";
import { getTicket } from "@/server/services/tickets";
import { ticketsRepository } from "@/server/repositories/tickets";
import { ticketIdSchema } from "@/server/validation/tickets";
import { changeTicket, type TicketContext } from "@/server/http/admin-ticket-handlers";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  return api(async () => json(await getTicket(requireAuthenticated(await getCurrentPrincipal()), ticketIdSchema.parse((await context.params).ticketId), ticketsRepository)));
}
export function PATCH(request: Request, context: TicketContext) { return changeTicket(request, context, "update"); }
