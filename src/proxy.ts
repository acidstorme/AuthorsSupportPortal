import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSessionCookie, sessionCookieOptions } from "@/server/auth/cookie-policy";
import { getCoreServerEnv } from "@/server/config/env";

// Refresh only. Every protected page/API independently verifies identity and DB role.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/auth/") || !request.cookies.getAll().some(({ name, value }) => value && isSessionCookie(name, process.env.SUPABASE_PROJECT_REF))) return NextResponse.next();
  let response = NextResponse.next({ request });
  try {
    const env = getCoreServerEnv();
    const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookieOptions: sessionCookieOptions(env.APP_URL),
      global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(10_000) }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const { name, value } of values) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of values) response.cookies.set(name, value, { ...options, ...sessionCookieOptions(env.APP_URL) });
        },
      },
    });
    await client.auth.getUser();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    // No private data is produced here; route-level verification still fails closed.
    return response;
  }
}

export const config = { matcher: ["/login", "/author/:path*", "/admin/:path*", "/api/:path*"] };
