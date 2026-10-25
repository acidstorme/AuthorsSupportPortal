import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label="BookLeaf Publishing home">
    <span className="brand-mark" aria-hidden="true">/</span>
    <span className="leading-tight"><span className="block text-lg font-medium tracking-tight">BookLeaf Publishing</span><span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Author support</span></span>
  </Link>;
}
