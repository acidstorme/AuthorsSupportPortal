"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AttachmentPlaceholder } from "@/components/tickets/attachment-placeholder";
import type { PublicMessageDto as Message, TicketDto as Ticket } from "@/shared/contracts/tickets";

type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };
const field = "w-full rounded-md border border-border bg-background p-3 text-sm";
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Request failed. Please try again.");
  return result as T;
}
function useRequestId() {
  const previous = useRef<{ content: string; id: string } | null>(null);
  const forContent = (content: unknown) => {
    const serialized = JSON.stringify(content);
    if (previous.current?.content !== serialized) previous.current = { content: serialized, id: crypto.randomUUID() };
    return previous.current!.id;
  };
  return { forContent, reset: () => { previous.current = null; } };
}
function Pagination({ page, total, size, change }: { page: number; total: number; size: number; change: (page: number) => void }) {
  return <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => change(page - 1)}>Previous</Button><span className="text-sm">Page {page} · {total} total</span><Button variant="outline" disabled={page * size >= total} onClick={() => change(page + 1)}>Next</Button></div>;
}
export function AuthorTickets() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("created_desc");
  const query = useQuery({ queryKey: ["tickets", page, status, sort], queryFn: () => request<Page<Ticket>>(`/api/tickets?page=${page}&pageSize=10&sort=${sort}${status ? `&status=${status}` : ""}`), refetchInterval: 10_000 });
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your support tickets</h2><Link className="font-medium text-primary underline" href="/author/tickets/new">Create a ticket</Link></div>
    <div className="flex flex-wrap gap-3"><label>Status <select className={field} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s}>{s}</option>)}</select></label><label>Sort <select className={field} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="created_desc">Newest first</option><option value="updated_desc">Recently updated</option></select></label></div>
    {query.isPending && <p>Loading tickets…</p>}{query.error && <p role="alert">{query.error.message}</p>}
    {query.data && <><ul className="divide-y rounded-lg border border-border">{query.data.data.map((ticket) => <li className="p-4" key={ticket.id}><Link className="font-semibold text-primary underline" href={`/author/tickets/${ticket.id}`}>{ticket.subject}</Link><p className="mt-1 text-sm text-muted-foreground">{ticket.status} · {ticket.category ?? "Awaiting triage"} · {ticket.priority ?? "Unclassified"} · {new Date(ticket.createdAt).toLocaleString()}</p></li>)}</ul>{query.data.meta.total === 0 && <p>No tickets match this view.</p>}<Pagination page={page} size={10} total={query.data.meta.total} change={setPage} /></>}
  </section>;
}
export function NewTicket({ books }: { books: { bookId: string; title: string }[] }) {
  const router = useRouter();
  const client = useQueryClient();
  const requestId = useRequestId();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookId, setBookId] = useState("");
  const mutation = useMutation({ mutationFn: (body: unknown) => request<{ data: Ticket }>("/api/tickets", body), onSuccess: async (result) => { requestId.reset(); await client.invalidateQueries({ queryKey: ["tickets"] }); router.push(`/author/tickets/${result.data.id}`); } });
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const input = { subject, description, bookId: bookId || null }; mutation.mutate({ ...input, requestId: requestId.forContent(input) }); }}>
    <label className="block space-y-2"><span>Related book</span><select disabled={mutation.isPending} className={field} value={bookId} onChange={(e) => setBookId(e.target.value)}><option value="">General / account-level inquiry</option>{books.map((book) => <option key={book.bookId} value={book.bookId}>{book.title}</option>)}</select></label>
    <label className="block space-y-2"><span>Subject</span><input required maxLength={200} disabled={mutation.isPending} className={field} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
    <label className="block space-y-2"><span>Describe your issue</span><textarea required maxLength={8000} rows={7} disabled={mutation.isPending} className={field} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <AttachmentPlaceholder />
    {mutation.error && <p role="alert">{mutation.error.message}</p>}
    <Button disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create ticket"}</Button>
  </form>;
}
export function TicketConversation({ ticketId }: { ticketId: string }) {
  const client = useQueryClient();
  const requestId = useRequestId();
  const [page, setPage] = useState(1);
  const [body, setBody] = useState("");
  const ticket = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => request<{ data: Ticket }>(`/api/tickets/${ticketId}`), refetchInterval: 5000 });
  const messages = useQuery({ queryKey: ["messages", ticketId, page], queryFn: () => request<Page<Message>>(`/api/tickets/${ticketId}/messages?page=${page}&pageSize=20`), refetchInterval: 5000, enabled: ticket.isSuccess });
  const mutation = useMutation({ mutationFn: (input: unknown) => request(`/api/tickets/${ticketId}/messages`, input), onSuccess: async () => { requestId.reset(); setBody(""); await client.invalidateQueries({ queryKey: ["messages", ticketId] }); await client.invalidateQueries({ queryKey: ["ticket", ticketId] }); } });
  if (ticket.isPending) return <p>Loading ticket…</p>;
  if (ticket.error) return <p role="alert">{ticket.error.message}</p>;
  const detail = ticket.data!.data;
  return <div className="space-y-6"><section className="space-y-3"><h1 className="text-2xl font-semibold">{detail.subject}</h1><p className="text-sm text-muted-foreground">{detail.status} · {detail.category ?? "Awaiting triage"} · {detail.priority ?? "Unclassified"} · {detail.bookId ?? "General inquiry"}</p><p className="whitespace-pre-wrap break-words rounded-lg border p-4">{detail.description}</p></section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Conversation</h2><p className="text-sm text-muted-foreground">Checks for updates every 5 seconds while this tab is active.</p>
      {messages.isPending && <p>Loading messages…</p>}{messages.error && <p role="alert">{messages.error.message}</p>}
      {messages.data && <><ol className="space-y-3">{messages.data.data.map((message) => <li key={message.id} className="rounded-lg border p-4"><p className="text-sm font-medium">{message.sender.displayName} · {message.sender.role === "ADMIN" ? "BookLeaf support" : "Author"}</p><time className="text-xs text-muted-foreground" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time><p className="mt-3 whitespace-pre-wrap break-words">{message.body}</p></li>)}</ol>{messages.data.meta.total === 0 && <p>No replies yet.</p>}<Pagination page={page} size={20} total={messages.data.meta.total} change={setPage} /></>}
    </section>
    {detail.status === "CLOSED" ? <p className="rounded-lg border p-4">This ticket is closed. You can read the conversation, but cannot add replies.</p> : <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ body, requestId: requestId.forContent({ body }) }); }}><label className="block space-y-2"><span>Your reply</span><textarea className={field} required maxLength={8000} rows={4} value={body} disabled={mutation.isPending} onChange={(e) => setBody(e.target.value)} /></label>{detail.status === "RESOLVED" && <p className="text-sm text-muted-foreground">You can reply to this resolved ticket. Replying does not reopen it.</p>}<AttachmentPlaceholder />{mutation.error && <p role="alert">{mutation.error.message}</p>}<Button disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send reply"}</Button></form>}
  </div>;
}
