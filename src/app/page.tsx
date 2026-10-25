import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import Link from "@/components/navigation-link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header><Brand /></header>
      <section className="surface space-y-6 border-t-4 border-t-[#f6637b] p-7 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Author support portal</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Author support,<br />built with care.</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">Your next chapter starts with a little support. View your books, raise a request, and stay connected with the BookLeaf team.</p>
        <Button asChild><Link href="/login">Sign in<ArrowRight size={17} aria-hidden="true" /></Link></Button>
      </section>
      <footer className="border-t border-border pt-5 text-sm text-muted-foreground">Isolated assignment demo · Author support tickets are available after sign-in.</footer>
    </main>
  );
}
