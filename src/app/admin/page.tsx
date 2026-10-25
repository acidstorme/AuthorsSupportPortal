import { requirePageRole } from "@/server/auth/current-user";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/auth/logout-button";
import { AdminQueue } from "@/features/tickets/admin-client";

export default async function AdminPage() {
  const principal = await requirePageRole("ADMIN");
  return <main className="mx-auto max-w-6xl space-y-8 px-6 py-12"><div className="flex items-center justify-between gap-4"><Brand href="/admin" /><LogoutButton /></div><header className="portal-header flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">BookLeaf · Administration</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {principal.displayName}</h1><p className="mt-2 text-muted-foreground">Keep every author moving forward. Review, prioritise, and respond to requests.</p></div></header><AdminQueue /></main>;
}
