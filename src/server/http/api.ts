import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function api(action: () => Promise<Response>) {
  try { return await action(); } catch (error) {
    const requestId = randomUUID();
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", fieldErrors: z.flattenError(error).fieldErrors, requestId } }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }
    const known = error instanceof AppError;
    if (!known) console.error("Request failed", { requestId, type: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: { code: known ? error.code : "SERVICE_UNAVAILABLE", message: known ? error.message : "Service unavailable. Please try again.", requestId } }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}

export function requireSameOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected) throw new AppError(503, "CONFIGURATION_REQUIRED", "Application origin is not configured.");
  if (request.headers.get("origin") !== new URL(expected).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError(403, "ORIGIN_DENIED", "A same-origin request is required.");
  }
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AppError(400, "INVALID_CONTENT_TYPE", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "INVALID_JSON", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new AppError(413, "BODY_TOO_LARGE", "Request body is too large."); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  } finally { reader.releaseLock(); }
}
