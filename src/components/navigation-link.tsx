"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import { PageSkeleton } from "./page-skeleton";

function NavigationFeedback({ href }: { href: ComponentProps<typeof Link>["href"] }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  const path = typeof href === "string" ? href : href.pathname ?? "";
  const kind = path.endsWith("/new") ? "form" : path.includes("/tickets/") ? "ticket" : path.startsWith("/login") ? "login" : "portal";
  return createPortal(<div className="fixed inset-0 z-50 overflow-y-auto bg-background"><PageSkeleton kind={kind} /></div>, document.body);
}

export default function NavigationLink({ children, href, ...props }: ComponentProps<typeof Link>) {
  return <Link href={href} {...props}>{children}<NavigationFeedback href={href} /></Link>;
}
