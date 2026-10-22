import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentPlaceholder } from "@/components/tickets/attachment-placeholder";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex items-center gap-3 text-primary"><BookOpen aria-hidden="true" size={28} /><span className="text-lg font-semibold tracking-tight">BookLeaf Publishing</span></header>
      <section className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Milestone 1 · Foundation</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Author support,<br />built with care.</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">The project foundation is ready for review. Sign-in, book records, support tickets, and AI assistance will arrive in subsequent milestones.</p>
        <Button disabled>Sign-in coming in Milestone 2</Button>
      </section>
      <section aria-labelledby="attachment-heading" className="space-y-3">
        <h2 id="attachment-heading" className="text-sm font-semibold">Attachment preview</h2>
        <AttachmentPlaceholder />
      </section>
      <footer className="border-t border-border pt-5 text-sm text-muted-foreground">Development scaffold · No account access or support requests available yet.</footer>
    </main>
  );
}
