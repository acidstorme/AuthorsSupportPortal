import { api, json, readJson, requireSameOrigin } from "@/server/http/api";
import { loginSchema } from "@/server/validation/login";
import { login } from "@/server/services/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    requireSameOrigin(request);
    const { email, password } = loginSchema.parse(await readJson(request));
    return json(await login(email, password));
  });
}
