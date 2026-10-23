import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { landingPath } from "@/server/auth/policy";
import { AppError } from "@/server/http/errors";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let denied = false;
  let principal;
  try { principal = await getCurrentPrincipal(false); } catch (error) {
    if (error instanceof AppError && error.status === 403) denied = true;
    else throw error;
  }
  if (principal) redirect(landingPath(principal.role));
  const query = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
    <Link href="/" className="text-sm font-semibold text-primary">BookLeaf Publishing</Link>
    <div><h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-muted-foreground">Sign in to your author or administrator account.</p></div>
    {(denied || query.error === "access_denied") && <p role="alert" className="text-sm text-red-800">This identity has no application access. Contact the demo administrator.</p>}
    {query.error === "logout_partial" && <p role="status" className="text-sm text-muted-foreground">Your local session was cleared. Remote session revocation was temporarily unavailable.</p>}
    <LoginForm />
  </main>;
}
