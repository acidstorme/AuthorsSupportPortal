import { api, json } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireRole } from "@/server/auth/policy";

export const runtime = "nodejs";
export async function GET() {
  return api(async () => {
    const user = requireRole(await getCurrentPrincipal(), "ADMIN");
    return json({ user, message: "Administrative access verified. Ticket management is available at /admin." });
  });
}
