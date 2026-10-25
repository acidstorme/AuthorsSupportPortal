"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(form.get("email")).trim(), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to sign in.");
      queryClient.clear();
      router.replace(body.data.redirectTo === "/admin" ? "/admin" : "/author");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to reach the sign-in service. Please try again.");
      submitting.current = false; setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="space-y-2"><label className="text-sm font-medium" htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="username" className="block h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></div>
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="password">Password</label>
      <div className="relative">
        <input id="password" name="password" type={showPassword ? "text" : "password"} required maxLength={200} autoComplete="current-password" className="block h-11 w-full rounded-md border border-input bg-background pl-3 pr-12 outline-none focus:ring-2 focus:ring-ring" />
        <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="password" title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in…" : "Sign in"}</Button>
    <p className="text-sm leading-relaxed text-muted-foreground">Access is provided by the demo administrator. Public registration and password reset are unavailable.</p>
  </form>;
}
