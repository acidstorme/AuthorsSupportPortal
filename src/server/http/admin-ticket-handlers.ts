import { NextResponse } from "next/server";
import { api, json, readJson, requireSameOrigin } from "./api";
import { getCurrentPrincipal } from "../auth/current-user";
import { requireRole } from "../auth/policy";
import { adminHistory, adminMutation } from "../services/admin-tickets";
import { adminTicketsRepository } from "../repositories/admin-tickets";
import { acknowledgeSchema, emptySchema, noteSchema, updateTicketSchema } from "../validation/admin-tickets";
import { messageListSchema, ticketIdSchema } from "../validation/tickets";
export type TicketContext = { params: Promise<{ ticketId: string }> };
export function changeTicket(request: Request, context: TicketContext, kind: "update" | "assign" | "unassign" | "note" | "acknowledge") {
  return api(async () => {
    requireSameOrigin(request);
    const principal = requireRole(await getCurrentPrincipal(), "ADMIN");
    const id = ticketIdSchema.parse((await context.params).ticketId);
    if (kind === "unassign") return json(await adminMutation(principal, id, { kind: "assignment", assignee: null }, adminTicketsRepository));
    const input = await readJson(request);
    if (kind === "update") return json(await adminMutation(principal, id, { kind: "update", input: updateTicketSchema.parse(input) }, adminTicketsRepository));
    if (kind === "assign") { emptySchema.parse(input); return json(await adminMutation(principal, id, { kind: "assignment", assignee: principal.id }, adminTicketsRepository)); }
    if (kind === "note") { const note = noteSchema.parse(input); return json(await adminMutation(principal, id, { kind: "note", body: note.body, requestId: note.requestId }, adminTicketsRepository), 201); }
    return json(await adminMutation(principal, id, { kind: "acknowledge", observedReplyAt: acknowledgeSchema.parse(input).observedReplyAt }, adminTicketsRepository));
  });
}
export function ticketHistory(request: Request, context: TicketContext, kind: "notes" | "events") {
  return api(async () => {
    const principal = requireRole(await getCurrentPrincipal(), "ADMIN");
    const id = ticketIdSchema.parse((await context.params).ticketId);
    const query = messageListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await adminHistory(principal, id, kind, query, adminTicketsRepository), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  });
}
