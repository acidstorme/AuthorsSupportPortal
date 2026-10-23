import { requirePageRole } from "@/server/auth/current-user";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminPage() {
  const principal = await requirePageRole("ADMIN");
  return <main className="mx-auto max-w-4xl space-y-8 px-6 py-12"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">BookLeaf · Administration</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {principal.displayName}</h1><p className="mt-2 text-muted-foreground">{principal.email} · {principal.role}</p></div><LogoutButton /></header><section className="rounded-lg border border-border p-6"><h2 className="text-xl font-semibold">Administrative access verified</h2><p className="mt-3 text-muted-foreground">Both demo administrators have the same permissions. Ticket queues, status management, notes, assignment, and AI-assisted responses arrive in later milestones.</p></section></main>;
}
