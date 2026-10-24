import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCoreServerEnv } from "@/server/config/env";
import { isSessionCookie, sessionCookieOptions } from "./cookie-policy";

// All token access is server-side. Browser components call our REST endpoints.
export async function createRouteSupabaseClient(writable = true) {
  const env = getCoreServerEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(env.APP_URL),
    global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(10_000) }) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        // Server Components are read-only; proxy persists refresh cookies before rendering.
        if (!writable) return;
        for (const { name, value, options } of values) cookieStore.set(name, value, { ...options, ...sessionCookieOptions(env.APP_URL) });
      },
    },
  });
}

export async function hasSessionCookie() {
  return (await cookies()).getAll().some(({ name, value }) => value && isSessionCookie(name, process.env.SUPABASE_PROJECT_REF));
}

export async function clearSessionCookies() {
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (isSessionCookie(name, process.env.SUPABASE_PROJECT_REF)) store.set(name, "", { ...sessionCookieOptions(process.env.APP_URL ?? "http://localhost:3000"), maxAge: 0 });
  }
}
