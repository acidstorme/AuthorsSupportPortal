import { NextResponse } from "next/server";
import { api } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";
import { listBooks } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { bookQuerySchema } from "@/server/validation/books";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(async () => {
    const principal = requireAuthenticated(await getCurrentPrincipal());
    const query = bookQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(await listBooks(principal, query, booksRepository), { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  });
}
