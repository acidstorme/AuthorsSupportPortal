import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/server/auth/current-user";
import { ticketIdSchema } from "@/server/validation/tickets";
import { TicketConversation } from "@/features/tickets/client";
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requirePageRole("AUTHOR");
  const id = ticketIdSchema.safeParse((await params).ticketId);
  if (!id.success) notFound();
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12"><Link className="text-primary underline" href="/author">Back to your portal</Link><TicketConversation ticketId={id.data} /></main>;
}
