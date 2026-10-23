import { api, requireSameOrigin } from "@/server/http/api";
import { logout } from "@/server/services/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    requireSameOrigin(request);
    await logout();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  });
}
