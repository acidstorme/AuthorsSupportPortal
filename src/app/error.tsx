"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-5 px-6 py-20"><h1 className="text-2xl font-semibold">This page is temporarily unavailable</h1><p className="text-muted-foreground">Please try again. If this is a new setup, ask the administrator to check the hosted database and authentication configuration.</p><div className="flex gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><Link href="/login">Return to sign in</Link></Button></div></main>;
}
