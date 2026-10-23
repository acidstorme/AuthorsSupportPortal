import { api, json } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";

export const runtime = "nodejs";
export async function GET() { return api(async () => json(requireAuthenticated(await getCurrentPrincipal()))); }
