import { z } from "zod";
import { api, json, readJson, requireSameOrigin } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireRole } from "@/server/auth/policy";
import { draftTicket } from "@/server/services/ai";
import { aiRepository } from "@/server/repositories/ai";
import { getAIProvider } from "@/server/ai/providers";
import { ticketIdSchema } from "@/server/validation/tickets";
const schema = z.strictObject({ regenerate: z.boolean().default(false) });
export const runtime = "nodejs";
export const maxDuration = 60;
export function POST(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  return api(async () => {
    requireSameOrigin(request); const principal = requireRole(await getCurrentPrincipal(), "ADMIN");
    const id = ticketIdSchema.parse((await context.params).ticketId); const input = schema.parse(await readJson(request));
    return json(await draftTicket(principal, id, input.regenerate, aiRepository, getAIProvider));
  });
}
