import { api, json } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireRole } from "@/server/auth/policy";
import { adminDetail } from "@/server/services/admin-tickets";
import { adminTicketsRepository } from "@/server/repositories/admin-tickets";
import { ticketIdSchema } from "@/server/validation/tickets";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  return api(async () => json(await adminDetail(requireRole(await getCurrentPrincipal(), "ADMIN"), ticketIdSchema.parse((await context.params).ticketId), adminTicketsRepository)));
}
