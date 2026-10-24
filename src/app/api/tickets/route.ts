import { NextResponse } from "next/server";
import { api, json, readJson, requireSameOrigin } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";
import { listTickets } from "@/server/services/tickets";
import { createTicketWithAI } from "@/server/services/create-ticket-with-ai";
import { ticketsRepository } from "@/server/repositories/tickets";
import { createTicketSchema, ticketListSchema } from "@/server/validation/tickets";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  return api(async () => {
    const principal = requireAuthenticated(await getCurrentPrincipal());
    const query = ticketListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await listTickets(principal, query, ticketsRepository), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    requireSameOrigin(request);
    const principal = requireAuthenticated(await getCurrentPrincipal());
    const result = await createTicketWithAI(principal, createTicketSchema.parse(await readJson(request)));
    return json(result.ticket, result.replayed ? 200 : 201);
  });
}
