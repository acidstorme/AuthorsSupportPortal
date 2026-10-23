import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../http/errors";

export async function verifiedIdentity(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || error.status === 400) return null;
    throw new AppError(error.status === 429 ? 429 : 503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.");
  }
  return data.user ? { id: data.user.id, email: data.user.email } : null;
}
