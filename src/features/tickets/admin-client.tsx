"use client";
import { useExclusiveMutation } from "./use-exclusive-mutation";
import { ContentSkeleton } from "@/components/page-skeleton";
import Link from "@/components/navigation-link";
import { ArrowRight, Clock3 } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/tickets/status-badge";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { AdminTicketDto, NoteDto, EventDto } from "@/shared/contracts/admin-tickets";
import { TicketConversation } from "./client";
import { AIComposer } from "./ai-composer";
import { auditDetails, auditTitle } from "./audit-history";
import { ticketCategoryLabels as categories } from "@/shared/ticket-labels";
type Page<T> = { data: T[]; meta: { total: number; page: number; pageSize: number } };
const field = "rounded-md border border-border bg-background p-2 text-sm";
const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const sortLabels: Record<string, string> = { created_desc: "Newest first", created_asc: "Oldest first", updated_desc: "Recently updated", priority_desc: "Most urgent first" };
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Request failed. Please try again.");
  return result as T;
}
function Pages({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  return <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => change(page - 1)}>Previous</Button><span className="text-sm">Page {page} · {total} total</span><Button variant="outline" disabled={page * 20 >= total} onClick={() => change(page + 1)}>Next</Button></div>;
}
export function AdminQueue() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "", category: "", priority: "", assignment: "all", attention: "all", sort: "created_desc", search: "", createdFrom: "", createdTo: "", unresolved: "all" });
  const queryString = new URLSearchParams({ page: String(page), pageSize: "20", ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")) }).toString();
  const query = useQuery({ queryKey: ["admin-queue", queryString], queryFn: () => request<Page<AdminTicketDto>>(`/api/admin/tickets?${queryString}`), refetchInterval: 10000 });
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value,
      ...(key === "unresolved" && value === "only" && ["RESOLVED", "CLOSED"].includes(previous.status) ? { status: "" } : {}),
      ...(key === "status" && ["RESOLVED", "CLOSED"].includes(value) ? { unresolved: "all" } : {}) })); setPage(1);
  };
  return <section className="space-y-5"><h2 className="text-2xl font-semibold">Support queue</h2><p className="text-sm text-muted-foreground">Checks for updates every 10 seconds while this tab is active. Category and priority filters use manual values first, then AI values.</p>
    <form className="filter-panel items-end" onSubmit={(e) => { e.preventDefault(); change("search", search); }}><label className="grid gap-1">Search subject or author<input name="search" placeholder="Find a ticket…" maxLength={200} className={field} value={search} onChange={(event) => setSearch(event.target.value)} /></label><Button variant="outline">Search</Button>
      {([ ["status", statuses], ["priority", priorities], ["category", Object.keys(categories)], ["assignment", ["all", "mine", "unassigned"]], ["attention", ["all", "unseen"]], ["unresolved", ["all", "only"]], ["sort", ["created_desc", "created_asc", "updated_desc", "priority_desc"]] ] as [keyof typeof filters, string[]][]).map(([key, values]) => <label key={key} className="grid gap-1 capitalize">{key}<select className={field} value={filters[key]} onChange={(e) => change(key, e.target.value)}>{["status", "category", "priority"].includes(key) && <option value="">All</option>}{values.map((value) => <option key={value} value={value}>{categories[value as keyof typeof categories] ?? (sortLabels[value] ?? value.replaceAll("_", " "))}</option>)}</select></label>)}
      <label className="grid gap-1">Created from (UTC)<input type="date" className={field} value={filters.createdFrom} max={filters.createdTo || undefined} onChange={(e) => change("createdFrom", e.target.value)} /></label>
      <label className="grid gap-1">Created through (UTC)<input type="date" className={field} value={filters.createdTo} min={filters.createdFrom || undefined} onChange={(e) => change("createdTo", e.target.value)} /></label>
    </form>
    <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => { setFilters((previous) => ({ ...previous, status: "", unresolved: "only", sort: "created_asc" })); setPage(1); }}>Oldest unresolved first</Button><Button variant="outline" onClick={() => { setSearch(""); setFilters({ status: "", category: "", priority: "", assignment: "all", attention: "all", sort: "created_desc", search: "", createdFrom: "", createdTo: "", unresolved: "all" }); setPage(1); }}>Reset filters</Button></div>
    {query.isPending && <ContentSkeleton label="Loading queue" />}{query.error && <p role="alert">{query.error.message}</p>}
    {query.data && <><div className="flex items-center justify-between text-sm text-muted-foreground"><p>{query.data.meta.total} tickets in this view</p><span>Latest activity, in one place</span></div><ul className="space-y-5">{query.data.data.map((ticket) => <li key={ticket.id}><Link href={`/admin/tickets/${ticket.id}`} className="ticket-card group"><div className="flex flex-wrap items-center gap-3"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} />{ticket.needsAttention && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">New author reply after resolution</span>}</div><div className="mt-4 flex items-start justify-between gap-4"><h3 className="min-w-0 break-words text-lg font-semibold group-hover:text-primary">{ticket.subject}</h3><ArrowRight className="mt-1 shrink-0 text-primary" size={18} aria-hidden="true" /></div><p className="mt-2 break-words text-sm">{ticket.author.name} <span className="text-muted-foreground">({ticket.author.authorId}) · {ticket.book?.title ?? "General inquiry"}</span></p><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>{ticket.category ? categories[ticket.category] : "Awaiting triage"} · {ticket.assignedTo?.displayName ?? "Unassigned"}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13} aria-hidden="true" />Created <time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleString()}</time></span></div></Link></li>)}</ul>{query.data.meta.total === 0 && <p className="empty-state">No tickets match these filters.</p>}<Pages page={page} total={query.data.meta.total} change={setPage} /></>}
  </section>;
}
function History({ ticketId, kind }: { ticketId: string; kind: "notes" | "events" }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin-history", ticketId, kind, page], queryFn: () => request<Page<NoteDto | EventDto>>(`/api/tickets/${ticketId}/${kind}?page=${page}&pageSize=20`), refetchInterval: 5000 });
  return <section className="space-y-3"><h2 className="text-xl font-semibold">{kind === "notes" ? "Private admin notes" : "Audit history"}</h2>{query.isPending && <ContentSkeleton label={`Loading ${kind}`} count={2} />}{query.error && <p role="alert">{query.error.message}</p>}{query.data && <><ul className="space-y-2">{query.data.data.map((item) => <li key={item.id} className="rounded border p-3 text-sm">{"body" in item ? <><p className="font-medium">{item.creator.displayName} · Private</p><p className="whitespace-pre-wrap break-words">{item.body}</p></> : <><p className="font-medium">{auditTitle(item.type)} · {item.actor?.displayName ?? "System"}</p>{auditDetails(item.type, item.metadata).map((line, index) => <p key={index} className="mt-2 whitespace-pre-wrap break-words">{line}</p>)}</>}<time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ul>{query.data.meta.total === 0 && <p>No {kind} yet.</p>}<Pages page={page} total={query.data.meta.total} change={setPage} /></>}</section>;
}
export function AdminTicket({ ticketId, adminId }: { ticketId: string; adminId: string }) {
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const noteRequest = useRef<{ body: string; id: string } | null>(null);
  const query = useQuery({ queryKey: ["admin-ticket", ticketId], queryFn: () => request<{ data: AdminTicketDto }>(`/api/admin/tickets/${ticketId}`), refetchInterval: 5000 });
  const mutation = useExclusiveMutation({ mutationFn: ({ suffix = "", method, body }: { suffix?: string; method: string; body?: unknown }) => request(`/api/tickets/${ticketId}${suffix}`, method, body), onSuccess: async (_data, variables) => {
    if (variables.suffix === "/notes") { setNote(""); noteRequest.current = null; }
    await Promise.all([client.invalidateQueries({ queryKey: ["admin-ticket", ticketId] }), client.invalidateQueries({ queryKey: ["admin-history", ticketId] }), client.invalidateQueries({ queryKey: ["ticket", ticketId] }), client.invalidateQueries({ queryKey: ["admin-queue"] })]);
  } });
  if (query.isPending) return <ContentSkeleton label="Loading ticket" />;
  if (query.error) return <p role="alert">{query.error.message}</p>;
  const ticket = query.data!.data;
  const busy = mutation.isPending;
  return <div className="space-y-8"><section className="surface space-y-4 p-5 sm:p-7"><h2 className="text-xl font-semibold">Ticket management</h2><p>{ticket.author.name} · {ticket.author.email} · {ticket.author.authorId}</p><p>{ticket.book?.title ?? "General inquiry"} · Assigned to {ticket.assignedTo?.displayName ?? "nobody"}</p>
    <div className="flex flex-wrap gap-3"><Button disabled={busy || ticket.assignedTo?.id === adminId} onClick={() => mutation.mutate({ suffix: "/assignment", method: "PUT", body: {} })}>{ticket.assignedTo ? "Assign to me" : "Take ownership"}</Button><Button variant="outline" disabled={busy || !ticket.assignedTo} onClick={() => mutation.mutate({ suffix: "/assignment", method: "DELETE" })}>Unassign</Button></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ method: "PATCH", body: { status: new FormData(e.currentTarget).get("status") } }); }}><label className="grid gap-1">Status<select name="status" key={ticket.status} defaultValue={ticket.status} className={field}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><Button disabled={busy} variant="outline">Apply status</Button></form><p className="text-sm text-muted-foreground">Status changes are explicit. Select OPEN to reopen a resolved or closed ticket. Assigning, replying and adding notes do not change status.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); mutation.mutate({ method: "PATCH", body: { manualCategory: form.get("category") || null, manualPriority: form.get("priority") || null } }); }}><label className="grid gap-1">Manual category<select className={field} name="category" key={ticket.manualCategory ?? "auto"} defaultValue={ticket.manualCategory ?? ""}><option value="">Use AI / awaiting triage</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1">Manual priority<select className={field} name="priority" key={ticket.manualPriority ?? "auto"} defaultValue={ticket.manualPriority ?? ""}><option value="">Use AI / awaiting triage</option>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label><Button variant="outline" disabled={busy}>Save classification</Button></form>
    <p className="text-sm text-muted-foreground">AI classification: {ticket.aiStatus} · {ticket.aiProvider === "MOCK" ? "MOCK deterministic test mode" : ticket.aiProvider ?? "No provider result"} · {ticket.aiModel ?? "—"}{ticket.aiErrorCode ? ` · ${ticket.aiErrorCode}` : ""}. Manual overrides always take precedence.</p>
    <Button variant="outline" disabled={busy} onClick={() => mutation.mutate({ suffix: "/classification", method: "POST", body: {} })}>Retry AI classification</Button>
    {ticket.needsAttention && <div className="space-y-3 rounded border border-amber-300 p-3"><p>A new author reply arrived after resolution. Review the conversation before acknowledging it.</p><Button disabled={busy} variant="outline" onClick={() => mutation.mutate({ suffix: "/acknowledge", method: "POST", body: { observedReplyAt: ticket.resolvedAuthorReplyAt } })}>Mark this author reply reviewed</Button></div>}
    {busy && <p role="status">Saving changes…</p>}
    {mutation.error && <p role="alert">{mutation.error.message}</p>}
  </section>
  <TicketConversation ticketId={ticketId} hideComposer />
  <AIComposer key={ticketId} ticketId={ticketId} closed={ticket.status === "CLOSED"} />
  <History ticketId={ticketId} kind="notes" />
  <form className="surface space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (noteRequest.current?.body !== note) noteRequest.current = { body: note, id: crypto.randomUUID() }; mutation.mutate({ suffix: "/notes", method: "POST", body: { body: note, requestId: noteRequest.current!.id } }); }}><label className="grid gap-2">New private admin note<textarea className={field} value={note} rows={4} maxLength={8000} required disabled={busy} onChange={(e) => setNote(e.target.value)} /></label><p className="text-sm text-muted-foreground">Only administrators can read this note. It is separate from the public conversation.</p><Button disabled={busy}>{busy && mutation.variables?.suffix === "/notes" ? "Adding note…" : "Add private note"}</Button></form>
  <History ticketId={ticketId} kind="events" /></div>;
}
