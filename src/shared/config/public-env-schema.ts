import { z } from "zod";

export function safeUrl(value: string) {
  try { return new URL(value); } catch { return undefined; }
}

export const nonPlaceholder = z.string().min(1).refine(
  (value) => !value.includes("replace-me") && !value.includes("<") && !value.startsWith("your-"),
  "Replace the example placeholder",
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((value) => safeUrl(value)?.protocol === "https:", "Use hosted Supabase HTTPS"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonPlaceholder.min(20),
});
