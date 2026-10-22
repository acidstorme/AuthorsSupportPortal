import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/server/config/env";

// Foundation for Route Handlers only. Login, role lookup and session-refresh proxy are not implemented yet.
export async function createRouteSupabaseClient() {
  const env = getServerEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { path: "/", sameSite: "lax", secure: new URL(env.APP_URL).protocol === "https:" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) cookieStore.set(name, value, options);
      },
    },
  });
}
