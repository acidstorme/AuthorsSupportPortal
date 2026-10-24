import "server-only";
import { parseRuntimeEnv, parseCoreEnv } from "./env-schema";
import { AppError } from "../http/errors";

// Lazy validation allows the public scaffold to build without live secrets.
// Every future server integration must obtain configuration through this function.
export function getServerEnv() {
  try { return parseRuntimeEnv(process.env); }
  catch { throw new AppError(503, "CONFIGURATION_REQUIRED", "Server integration configuration is incomplete. Contact the demo administrator."); }
}
export function getCoreServerEnv() {
  try { return parseCoreEnv(process.env); }
  catch { throw new AppError(503, "CONFIGURATION_REQUIRED", "Core server configuration is incomplete. Contact the demo administrator."); }
}
