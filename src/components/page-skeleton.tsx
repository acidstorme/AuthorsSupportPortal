function Block({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-border/70 motion-safe:animate-pulse ${className}`} />;
}

export function ContentSkeleton({ label = "Loading content", count = 3 }: { label?: string; count?: number }) {
  return <div role="status" aria-label={label} aria-busy="true" className="space-y-5">
    <span className="sr-only">{label}…</span>
    {Array.from({ length: count }, (_, i) => <div key={i} className="surface space-y-4 p-6">
      <Block className="h-5 w-28" /><Block className="h-7 w-2/3" />
      <Block className="h-4 w-full" /><Block className="h-4 w-4/5" />
    </div>)}
  </div>;
}

export function PageSkeleton({ kind = "portal" }: { kind?: "portal" | "ticket" | "form" | "login" }) {
  return <div className={`mx-auto space-y-8 px-6 py-12 ${kind === "portal" ? "max-w-6xl" : kind === "login" ? "max-w-lg" : "max-w-3xl"}`}>
    <div aria-hidden="true" className="flex items-center justify-between"><Block className="h-12 w-56" /><Block className="h-10 w-24" /></div>
    <div aria-hidden="true" className="space-y-4"><Block className="h-9 w-2/3" /><Block className="h-5 w-4/5" /></div>
    <ContentSkeleton label="Loading page" count={kind === "form" || kind === "login" ? 1 : 3} />
  </div>;
}
