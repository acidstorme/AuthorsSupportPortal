import { NextResponse } from "next/server";
import { api, json, readJson, requireSameOrigin } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";
import { listMessages, replyToTicket } from "@/server/services/tickets";
import { ticketsRepository } from "@/server/repositories/tickets";
import { createMessageSchema, messageListSchema, ticketIdSchema } from "@/server/validation/tickets";
export const runtime = "nodejs";
type Context = { params: Promise<{ ticketId: string }> };
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const principal = requireAuthenticated(await getCurrentPrincipal());
    const id = ticketIdSchema.parse((await context.params).ticketId);
    const query = messageListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await listMessages(principal, id, query, ticketsRepository), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    requireSameOrigin(request);
    const principal = requireAuthenticated(await getCurrentPrincipal());
    const id = ticketIdSchema.parse((await context.params).ticketId);
    const result = await replyToTicket(principal, id, createMessageSchema.parse(await readJson(request)), ticketsRepository);
    return json(result.message, result.replayed ? 200 : 201);
  });
}
