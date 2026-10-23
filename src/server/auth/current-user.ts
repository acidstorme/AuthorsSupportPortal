import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createRouteSupabaseClient, hasSessionCookie } from "./supabase";
import { verifiedIdentity } from "./gateway";
import { landingPath, requireRole, resolvePrincipal, type Role } from "./policy";
import { usersRepository } from "../repositories/users";
import { AppError } from "../http/errors";

export async function getCurrentPrincipal(writable = true) {
  if (!await hasSessionCookie()) return null;
  return resolvePrincipal(await verifiedIdentity(await createRouteSupabaseClient(writable)), usersRepository);
}

const getPagePrincipal = cache(() => getCurrentPrincipal(false));

export async function requirePageRole(role: Role) {
  let principal;
  try { principal = await getPagePrincipal(); }
  catch (error) {
    if (error instanceof AppError && error.status === 403) redirect("/login?error=access_denied");
    throw error;
  }
  if (!principal) redirect("/login");
  if (principal.role !== role) redirect(landingPath(principal.role));
  return requireRole(principal, role);
}
