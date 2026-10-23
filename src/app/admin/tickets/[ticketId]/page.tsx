import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/server/auth/current-user";
import { ticketIdSchema } from "@/server/validation/tickets";
import { AdminTicket } from "@/features/tickets/admin-client";
export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const principal = await requirePageRole("ADMIN");
  const result = ticketIdSchema.safeParse((await params).ticketId);
  if (!result.success) notFound();
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12"><Link className="text-primary underline" href="/admin">Back to support queue</Link><AdminTicket ticketId={result.data} adminId={principal.id} /></main>;
}
