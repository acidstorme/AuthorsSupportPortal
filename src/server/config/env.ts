import "server-only";
import { parseRuntimeEnv } from "./env-schema";

// Lazy validation allows the public scaffold to build without live secrets.
// Every future server integration must obtain configuration through this function.
export function getServerEnv() {
  return parseRuntimeEnv(process.env);
}
