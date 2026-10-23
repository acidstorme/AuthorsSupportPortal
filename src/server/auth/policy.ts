import { AppError } from "../http/errors";

export type Role = "AUTHOR" | "ADMIN";
export type Principal = { id: string; role: Role; email: string; displayName: string; authorId: string | null };
export type ApplicationIdentity = { id: string; role: Role; loginEmail: string; displayName: string; authorProfile: { authorId: string } | null };
export type VerifiedIdentity = { id: string; email?: string };
export interface IdentityRepository { findById(id: string): Promise<ApplicationIdentity | null> }

export async function resolvePrincipal(identity: VerifiedIdentity | null, repository: IdentityRepository): Promise<Principal | null> {
  if (!identity) return null;
  const user = await repository.findById(identity.id);
  if (!user || !identity.email || user.loginEmail !== identity.email.toLowerCase()) throw new AppError(403, "ACCOUNT_NOT_PROVISIONED", "This account has no application access. Contact the demo administrator.");
  if ((user.role === "AUTHOR" && !user.authorProfile) || (user.role === "ADMIN" && user.authorProfile)) throw new AppError(403, "INVALID_ACCOUNT_MAPPING", "Account mapping requires administrator attention.");
  return { id: user.id, email: user.loginEmail, displayName: user.displayName, role: user.role, authorId: user.authorProfile?.authorId ?? null };
}

export function requireAuthenticated(principal: Principal | null): Principal {
  if (!principal) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  return principal;
}

export function requireRole(principal: Principal | null, role: Role): Principal {
  const user = requireAuthenticated(principal);
  if (user.role !== role) throw new AppError(403, "FORBIDDEN", "This operation is not available for your role.");
  return user;
}

export function landingPath(role: Role) { return role === "ADMIN" ? "/admin" : "/author"; }

export function authorScope(principal: Principal, requestedAuthorId?: string) {
  if (principal.role === "ADMIN") return requestedAuthorId;
  if (requestedAuthorId) throw new AppError(403, "FORBIDDEN", "Author filters are available to administrators only.");
  if (!principal.authorId) throw new AppError(403, "INVALID_ACCOUNT_MAPPING", "Author mapping is missing.");
  return principal.authorId;
}
