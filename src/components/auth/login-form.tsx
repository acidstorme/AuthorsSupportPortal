"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(form.get("email")).trim(), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) { setError(body.error?.message ?? "Unable to sign in."); return; }
      queryClient.clear();
      router.replace(body.data.redirectTo === "/admin" ? "/admin" : "/author");
      router.refresh();
    } catch { setError("Unable to reach the sign-in service. Please try again."); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="space-y-2"><label className="text-sm font-medium" htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="username" className="block h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></div>
    <div className="space-y-2"><label className="text-sm font-medium" htmlFor="password">Password</label><input id="password" name="password" type="password" required maxLength={200} autoComplete="current-password" className="block h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in…" : "Sign in"}</Button>
    <p className="text-sm leading-relaxed text-muted-foreground">Access is provided by the demo administrator. Public registration and password reset are unavailable.</p>
  </form>;
}
