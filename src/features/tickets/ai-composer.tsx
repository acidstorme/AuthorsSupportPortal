"use client";
import { useExclusiveMutation } from "./use-exclusive-mutation";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { DraftDto } from "@/shared/contracts/ai";
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Request failed. Please try again.");
  return result as T;
}
export function AIComposer({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const bodyRef = useRef("");
  const [preview, setPreview] = useState<DraftDto | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const previewHeading = useId();
  const dialogHeading = useId();
  const opened = useRef(false);
  function updateBody(text: string) { bodyRef.current = text; setBody(text); }
  const request = useRef<{ body: string; id: string } | null>(null);
  const draft = useExclusiveMutation({ mutationFn: (regenerate: boolean) => post<{ data: DraftDto }>(`/api/tickets/${ticketId}/draft`, { regenerate }),
    onSuccess: ({ data }) => {
      // Read the latest editor value when the request completes, including text
      // entered or cleared while generation was in flight.
      if (!bodyRef.current.trim()) { updateBody(data.text); setPreview(null); }
      else setPreview(data);
    } });
  const { mutate: loadDraft } = draft;
  useEffect(() => {
    if (!closed && !opened.current) { opened.current = true; loadDraft(false); }
  }, [closed, loadDraft]);
  const send = useExclusiveMutation({ mutationFn: (input: { body: string; requestId: string }) => post(`/api/tickets/${ticketId}/messages`, input),
    onSuccess: async () => {
      request.current = null; updateBody(""); setPreview(null); dialog.current?.close();
      await Promise.all([client.invalidateQueries({ queryKey: ["messages", ticketId] }), client.invalidateQueries({ queryKey: ["ticket", ticketId] }), client.invalidateQueries({ queryKey: ["admin-ticket", ticketId] }), client.invalidateQueries({ queryKey: ["admin-history", ticketId] })]);
    } });
  const metadata = draft.data?.data;
  return <section className="space-y-4 rounded-lg border p-5"><h2 className="text-xl font-semibold">Response draft · admin review required</h2>
    <p className="text-sm text-muted-foreground">AI drafts are suggestions. Check policies and facts, edit as needed, then explicitly send. Nothing is sent automatically. You can always compose a manual reply.</p>
    {metadata && <p className="text-sm font-medium">{metadata.provider === "MOCK" ? "MOCK · deterministic test draft, not real AI" : "OpenAI draft"} · {metadata.model} · {metadata.cached ? "Saved cache" : "Generated now"}{metadata.stale ? " · Context changed: review or explicitly regenerate" : ""}</p>}
    <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={closed || draft.isPending || send.isPending} loading={draft.isPending && !draft.variables} onClick={() => draft.mutate(false)}>{draft.isPending && !draft.variables ? "Loading draft…" : "Load saved draft / retry"}</Button><Button type="button" variant="outline" disabled={closed || draft.isPending || send.isPending} loading={draft.isPending && !!draft.variables} onClick={() => draft.mutate(true)}>{draft.isPending && draft.variables ? "Generating…" : "Regenerate draft"}</Button></div>
    {draft.isPending && <p role="status">Preparing draft… You can write manually while waiting.</p>}
    {draft.error && <p role="alert">{draft.error.message} Manual replies remain available.</p>}
    {preview && <section aria-labelledby={previewHeading} className="flex min-w-0 items-center gap-4 rounded-md border bg-muted/30 p-3">
      <div className="min-w-0 flex-1"><h3 id={previewHeading} className="text-sm font-semibold">AI generated response</h3><p className="mt-1 truncate text-sm text-muted-foreground">{preview.text}</p></div>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => dialog.current?.showModal()}>View</Button>
    </section>}
    <dialog ref={dialog} aria-labelledby={dialogHeading} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-2xl rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="space-y-5 p-6"><header className="flex items-center justify-between gap-4"><h2 id={dialogHeading} className="text-xl font-semibold">AI generated response</h2><Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Close</Button></header>
        <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words text-sm" tabIndex={0}>{preview?.text}</div>
        <footer className="flex justify-end"><Button type="button" disabled={closed || send.isPending || !preview} onClick={() => {
          if (!preview) return;
          updateBody(preview.text); setPreview(null); dialog.current?.close(); editor.current?.focus();
        }}>Use generated text in editor</Button></footer>
      </div>
    </dialog>
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault(); if (closed || draft.isPending || send.isPending) return; if (request.current?.body !== body) request.current = { body, id: crypto.randomUUID() };
      send.mutate({ body, requestId: request.current!.id });
    }}><label className="grid gap-2">Reviewed public response<textarea ref={editor} className="rounded-md border bg-background p-3 text-sm" rows={9} maxLength={8000} required value={body} disabled={closed || send.isPending || draft.isPending} onChange={(e) => updateBody(e.target.value)} /></label>
      {closed && <p>Closed tickets are read-only. Reopen explicitly before drafting or sending.</p>}
      {send.error && <p role="alert">{send.error.message}</p>}{send.isSuccess && <p role="status">Response sent to the public conversation.</p>}
      <Button loading={send.isPending} disabled={closed || send.isPending || draft.isPending}>{send.isPending ? "Sending…" : "Send reviewed response"}</Button>
    </form>
  </section>;
}
