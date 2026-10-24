import { api, json, readJson, requireSameOrigin } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireRole } from "@/server/auth/policy";
import { retryClassification } from "@/server/services/ai";
import { aiRepository } from "@/server/repositories/ai";
import { getAIProvider } from "@/server/ai/providers";
import { ticketIdSchema } from "@/server/validation/tickets";
import { emptySchema } from "@/server/validation/admin-tickets";
export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  return api(async () => {
    requireSameOrigin(request); const principal = requireRole(await getCurrentPrincipal(), "ADMIN");
    const id = ticketIdSchema.parse((await context.params).ticketId); emptySchema.parse(await readJson(request));
    return json(await retryClassification(principal, id, aiRepository, getAIProvider));
  });
}
