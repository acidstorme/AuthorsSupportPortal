import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { requirePageRole } from "@/server/auth/current-user";
import { listBooks } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { NewTicket } from "@/features/tickets/client";
export default async function NewTicketPage() {
  const principal = await requirePageRole("AUTHOR");
  const books = await listBooks(principal, { page: 1, pageSize: 100, sort: "title_asc" }, booksRepository);
  return <main className="mx-auto max-w-2xl space-y-6 px-6 py-12"><div className="flex flex-wrap items-center justify-between gap-5"><Brand href="/author" /><Button asChild variant="outline"><Link href="/author"><ArrowLeft size={16} aria-hidden="true" />Back to your portal</Link></Button></div><h1 className="text-3xl font-semibold">Create a support ticket</h1><p className="text-muted-foreground">Tell us what you need help with. You can follow the conversation from your portal.</p><div className="surface p-5 sm:p-8"><NewTicket books={books.data.map(({ bookId, title }) => ({ bookId, title }))} /></div></main>;
}
