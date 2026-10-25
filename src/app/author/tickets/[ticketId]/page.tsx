import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/server/auth/current-user";
import { ticketIdSchema } from "@/server/validation/tickets";
import { TicketConversation } from "@/features/tickets/client";
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  await requirePageRole("AUTHOR");
  const id = ticketIdSchema.safeParse((await params).ticketId);
  if (!id.success) notFound();
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12"><div className="flex flex-wrap items-center justify-between gap-5"><Brand href="/author" /><Button asChild variant="outline"><Link href="/author"><ArrowLeft size={16} aria-hidden="true" />Back to your portal</Link></Button></div><TicketConversation ticketId={id.data} /></main>;
}
