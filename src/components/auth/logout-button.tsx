"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div><Button variant="outline" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 503) throw new Error();
      queryClient.clear(); router.replace(response.ok ? "/login" : "/login?error=logout_partial"); router.refresh();
    } catch { setError("Unable to sign out. Check your connection and try again."); setPending(false); }
  }}>{pending ? "Signing out…" : "Sign out"}</Button>{error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}</div>;
}
