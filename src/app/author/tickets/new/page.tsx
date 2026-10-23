import Link from "next/link";
import { requirePageRole } from "@/server/auth/current-user";
import { listBooks } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { NewTicket } from "@/features/tickets/client";
export default async function NewTicketPage() {
  const principal = await requirePageRole("AUTHOR");
  const books = await listBooks(principal, { page: 1, pageSize: 100, sort: "title_asc" }, booksRepository);
  return <main className="mx-auto max-w-2xl space-y-6 px-6 py-12"><Link className="text-primary underline" href="/author">Back to your portal</Link><h1 className="text-3xl font-semibold">Create a support ticket</h1><NewTicket books={books.data.map(({ bookId, title }) => ({ bookId, title }))} /></main>;
}
