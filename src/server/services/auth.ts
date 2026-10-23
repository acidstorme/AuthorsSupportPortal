import "server-only";
import { createRouteSupabaseClient, clearSessionCookies, hasSessionCookie } from "../auth/supabase";
import { verifiedIdentity } from "../auth/gateway";
import { landingPath, requireAuthenticated, resolvePrincipal } from "../auth/policy";
import { usersRepository } from "../repositories/users";
import { AppError } from "../http/errors";

export async function login(email: string, password: string) {
  const client = await createRouteSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new AppError(error.status === 429 ? 429 : error.status && error.status >= 500 ? 503 : 401, error.status === 429 ? "AUTH_RATE_LIMITED" : "LOGIN_FAILED", "Unable to sign in. Check your credentials or try again later.");
  try {
    const principal = requireAuthenticated(await resolvePrincipal(await verifiedIdentity(client), usersRepository));
    return { user: principal, redirectTo: landingPath(principal.role) };
  } catch (error) {
    try { await client.auth.signOut({ scope: "local" }); } finally { await clearSessionCookies(); }
    throw error;
  }
}

export async function logout() {
  try {
    if (await hasSessionCookie()) {
      const { error } = await (await createRouteSupabaseClient()).auth.signOut({ scope: "local" });
      if (error && error.status !== 401 && error.status !== 403 && error.status !== 404) throw new AppError(503, "LOGOUT_REVOKE_FAILED", "Local session cleared; remote session revocation is temporarily unavailable.");
    }
  } finally { await clearSessionCookies(); }
}
