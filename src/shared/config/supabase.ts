import { publicEnvSchema } from "./public-env-schema";

export function getSupabasePublicEnv() {
  // Explicit references are required for Next.js to inline public values in browser builds.
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
