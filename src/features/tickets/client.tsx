"use client";
import { useExclusiveMutation } from "./use-exclusive-mutation";
import { ContentSkeleton } from "@/components/page-skeleton";

import Link from "@/components/navigation-link";
import { ArrowRight, Clock3, MessageSquare, Plus } from "lucide-react";
import { PriorityBadge, StatusBadge, readable } from "@/components/tickets/status-badge";
import { ticketCategoryLabels } from "@/shared/ticket-labels";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-tight">Your support tickets</h2><p className="mt-1 text-sm text-muted-foreground">A little help for every chapter of your publishing journey.</p></div><Button asChild><Link href="/author/tickets/new"><Plus size={17} aria-hidden="true" />Create a ticket</Link></Button></div>
    <div className="filter-panel"><label>Status <select className={field} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{readable(s)}</option>)}</select></label><label>Sort <select className={field} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="created_desc">Newest first</option><option value="updated_desc">Recently updated</option></select></label></div>
    {query.isPending && <ContentSkeleton label="Loading tickets" />}{query.error && <p role="alert">{query.error.message}</p>}
    {query.data && <><ul className="space-y-5">{query.data.data.map((ticket) => <li key={ticket.id}><Link className="ticket-card group" href={`/author/tickets/${ticket.id}`}><div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div><div className="mt-4 flex items-start gap-3"><MessageSquare className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" /><h3 className="min-w-0 flex-1 break-words text-lg font-semibold group-hover:text-primary">{ticket.subject}</h3><ArrowRight className="mt-1 shrink-0 text-primary" size={18} aria-hidden="true" /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span>{ticket.category ? ticketCategoryLabels[ticket.category] : "Awaiting triage"}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13} aria-hidden="true" /><time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleString()}</time></span></div></Link></li>)}</ul>{query.data.meta.total === 0 && <p className="empty-state">No tickets match this view.</p>}<Pagination page={page} size={10} total={query.data.meta.total} change={setPage} /></>}
  </section>;
}
export function NewTicket({ books }: { books: { bookId: string; title: string }[] }) {
  const router = useRouter();
  const client = useQueryClient();
  const requestId = useRequestId();
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const created = useRef(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookId, setBookId] = useState("");
  const mutation = useExclusiveMutation({ mutationFn: (body: unknown) => request<{ data: Ticket }>("/api/tickets", body), onSuccess: (result) => { created.current = true; setCreatedTicketId(result.data.id); void client.invalidateQueries({ queryKey: ["tickets"] }); router.replace(`/author/tickets/${result.data.id}`); } });
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (created.current) return; const input = { subject, description, bookId: bookId || null }; mutation.mutate({ ...input, requestId: requestId.forContent(input) }); }}>
    <label className="block space-y-2"><span>Related book</span><select disabled={mutation.isPending || !!createdTicketId} className={field} value={bookId} onChange={(e) => setBookId(e.target.value)}><option value="">General / account-level inquiry</option>{books.map((book) => <option key={book.bookId} value={book.bookId}>{book.title}</option>)}</select></label>
    <label className="block space-y-2"><span>Subject</span><input required maxLength={200} disabled={mutation.isPending || !!createdTicketId} className={field} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
    <label className="block space-y-2"><span>Describe your issue</span><textarea required maxLength={8000} rows={7} disabled={mutation.isPending || !!createdTicketId} className={field} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <AttachmentPlaceholder />
    {createdTicketId && <p role="status">Ticket created. <Link className="underline" href={`/author/tickets/${createdTicketId}`}>Open your ticket</Link></p>}
    {mutation.error && <p role="alert">{mutation.error.message}</p>}
    <Button disabled={mutation.isPending || !!createdTicketId}>{createdTicketId ? "Opening ticket…" : mutation.isPending ? "Creating…" : "Create ticket"}</Button>
  </form>;
}
export function TicketConversation({ ticketId, hideComposer = false }: { ticketId: string; hideComposer?: boolean }) {
  const client = useQueryClient();
  const requestId = useRequestId();
  const [page, setPage] = useState(1);
  const [body, setBody] = useState("");
  const ticket = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => request<{ data: Ticket }>(`/api/tickets/${ticketId}`), refetchInterval: 5000 });
  const messages = useQuery({ queryKey: ["messages", ticketId, page], queryFn: () => request<Page<Message>>(`/api/tickets/${ticketId}/messages?page=${page}&pageSize=20`), refetchInterval: 5000, enabled: ticket.isSuccess });
  const mutation = useExclusiveMutation({ mutationFn: (input: unknown) => request(`/api/tickets/${ticketId}/messages`, input), onSuccess: async () => { requestId.reset(); setBody(""); await client.invalidateQueries({ queryKey: ["messages", ticketId] }); await client.invalidateQueries({ queryKey: ["ticket", ticketId] }); } });
  if (ticket.isPending) return <ContentSkeleton label="Loading ticket" />;
  if (ticket.error) return <p role="alert">{ticket.error.message}</p>;
  const detail = ticket.data!.data;
  return <div className="space-y-6"><section className="space-y-3"><h1 className="break-words text-2xl font-semibold">{detail.subject}</h1>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ticket details">
      <StatusBadge status={detail.status} />
      <span className="inline-flex max-w-full items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">{detail.category ? ticketCategoryLabels[detail.category] : "Awaiting triage"}</span>
      <PriorityBadge priority={detail.priority} />
      <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">{detail.bookId ?? "General inquiry"}</span>
    </div>
    <p className="surface whitespace-pre-wrap break-words p-5">{detail.description}</p></section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Conversation</h2>
      {messages.isPending && <ContentSkeleton label="Loading messages" count={2} />}{messages.error && <p role="alert">{messages.error.message}</p>}
      {messages.data && <><ol className="space-y-3">{messages.data.data.map((message) => <li key={message.id} className="surface p-5"><p className="text-sm font-medium">{message.sender.displayName} · {message.sender.role === "ADMIN" ? "BookLeaf support" : "Author"}</p><time className="text-xs text-muted-foreground" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time><p className="mt-3 whitespace-pre-wrap break-words">{message.body}</p></li>)}</ol>{messages.data.meta.total === 0 && <p>No replies yet.</p>}<Pagination page={page} size={20} total={messages.data.meta.total} change={setPage} /></>}
    </section>
    {detail.status === "CLOSED" ? <p className="surface p-5">This ticket is closed. You can read the conversation, but cannot add replies.</p> : hideComposer ? null : <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ body, requestId: requestId.forContent({ body }) }); }}><label className="block space-y-2"><span>Your reply</span><textarea className={field} required maxLength={8000} rows={4} value={body} disabled={mutation.isPending} onChange={(e) => setBody(e.target.value)} /></label>{detail.status === "RESOLVED" && <p className="text-sm text-muted-foreground">You can reply to this resolved ticket. Replying does not reopen it.</p>}<AttachmentPlaceholder />{mutation.error && <p role="alert">{mutation.error.message}</p>}<Button disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send reply"}</Button></form>}
  </div>;
}
