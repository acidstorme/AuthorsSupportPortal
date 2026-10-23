import { api, json } from "@/server/http/api";
import { getCurrentPrincipal } from "@/server/auth/current-user";
import { requireAuthenticated } from "@/server/auth/policy";
import { getBook } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { bookIdSchema } from "@/server/validation/books";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ bookId: string }> }) {
  return api(async () => {
    const principal = requireAuthenticated(await getCurrentPrincipal());
    return json(await getBook(principal, bookIdSchema.parse((await context.params).bookId), booksRepository));
  });
}
