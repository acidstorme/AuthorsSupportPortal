import Link from "@/components/navigation-link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/server/auth/current-user";
import { ticketIdSchema } from "@/server/validation/tickets";
import { AdminTicket } from "@/features/tickets/admin-client";
export default async function AdminTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const principal = await requirePageRole("ADMIN");
  const result = ticketIdSchema.safeParse((await params).ticketId);
  if (!result.success) notFound();
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12"><div className="flex flex-wrap items-center justify-between gap-5"><Brand href="/admin" /><Button asChild variant="outline"><Link href="/admin"><ArrowLeft size={16} aria-hidden="true" />Back to support queue</Link></Button></div><AdminTicket ticketId={result.data} adminId={principal.id} /></main>;
}
