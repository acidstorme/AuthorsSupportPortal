const colors: Record<string, string> = {
  OPEN: "border-blue-200 bg-blue-50 text-blue-800",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED: "border-stone-200 bg-stone-100 text-stone-600",
};

const priorityColors: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-800",
  HIGH: "border-orange-200 bg-orange-50 text-orange-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW: "border-slate-200 bg-slate-50 text-slate-700",
};

export function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[status] ?? colors.OPEN}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{readable(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityColors[priority ?? ""] ?? "border-stone-200 bg-stone-100 text-stone-600"}`}>{priority ? `${readable(priority)} priority` : "Unclassified"}</span>;
}
