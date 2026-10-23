import { NextResponse } from "next/server";
import { api } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireRole } from "@/server/auth/policy";
import { adminQueue } from "@/server/services/admin-tickets";
import { adminTicketsRepository } from "@/server/repositories/admin-tickets";
import { adminQueueSchema } from "@/server/validation/admin-tickets";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(async () => NextResponse.json(await adminQueue(requireRole(await getCurrentPrincipal(), "ADMIN"), adminQueueSchema.parse(Object.fromEntries(new URL(request.url).searchParams)), adminTicketsRepository), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }));
}
