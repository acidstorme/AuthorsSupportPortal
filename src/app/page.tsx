import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentPlaceholder } from "@/components/tickets/attachment-placeholder";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex items-center gap-3 text-primary"><BookOpen aria-hidden="true" size={28} /><span className="text-lg font-semibold tracking-tight">BookLeaf Publishing</span></header>
      <section className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Author support portal</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Author support,<br />built with care.</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">Sign in to view your author account and linked books, or access the administrator workspace. Support tickets and AI assistance are coming in later milestones.</p>
        <Button asChild><Link href="/login">Sign in</Link></Button>
      </section>
      <section aria-labelledby="attachment-heading" className="space-y-3">
        <h2 id="attachment-heading" className="text-sm font-semibold">Attachment preview</h2>
        <AttachmentPlaceholder />
      </section>
      <footer className="border-t border-border pt-5 text-sm text-muted-foreground">Isolated assignment demo · No support requests available yet.</footer>
    </main>
  );
}
