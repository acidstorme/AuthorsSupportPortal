import type { Principal } from "../auth/policy";
import type { CreateTicket } from "../validation/tickets";
import { ticketsRepository } from "../repositories/tickets";
import { aiRepository } from "../repositories/ai";
import { getAIProvider } from "../ai/providers";
import { createTicket } from "./tickets";
import { classifyPersistedTicket } from "./ai";
export async function createTicketWithAI(principal: Principal, input: CreateTicket) {
  const result = await createTicket(principal, input, ticketsRepository);
  if (!result.replayed) {
    // Persistence is complete first. This bounded attempt is awaited, never detached.
    try { await classifyPersistedTicket(result.ticket.id, aiRepository, getAIProvider); }
    catch { console.info("Ticket saved; AI triage unavailable", { ticketId: result.ticket.id }); }
  }
  return result;
}
