import { createHmac } from "node:crypto";
import { FaucetError, SOL_FAUCET_POLICY, type FaucetStatus } from "@agari/core/faucet";
import { isDbConfigured } from "@agari/db";
import { parseSecretKey } from "@agari/markets";
import { createFaucetChain } from "@agari/markets/faucet";
import { createFaucetService } from "./faucet-service.server";

/** The devnet SOL funder: a 64-byte Solana keypair (CLI JSON array or base58), server-only (D-012). */
export function faucetConfig() {
  const raw = process.env.SOL_FAUCET_PRIVATE_KEY;
  if (!raw) return null;
  let secretKey: Uint8Array;
  try { secretKey = parseSecretKey(raw); } catch { return null; }
  const chain = createFaucetChain(secretKey, process.env.SOL_FAUCET_RPC_URL);
  // The IP hash keys on the funder's secret bytes, so it can't be recomputed without the server's key.
  return { key: Buffer.from(secretKey).toString("hex"), chain, enabled: process.env.SOL_FAUCET_ENABLED === "true" && isDbConfigured() };
}
export function unavailableFaucetStatus(address: string | null, message = "In-app SOL funding is unavailable. You can use an external faucet."): FaucetStatus {
  return { configured: false, ready: false, address, fundingBalanceLamports: null, walletBalanceLamports: null, dailyRemainingLamports: null, targetLamports: SOL_FAUCET_POLICY.targetLamports.toString(), thresholdLamports: SOL_FAUCET_POLICY.thresholdLamports.toString(), claim: null, message };
}
export function faucetForRequest(request: Request) {
  const origin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin && suppliedOrigin !== origin) throw new FaucetError("origin-invalid", "Open the faucet from Agari.", 403);
  const config = faucetConfig();
  if (!config?.enabled) throw new FaucetError("unavailable", "In-app SOL funding is unavailable. Please use an external faucet.", 503);
  // Vercel overwrites x-forwarded-for at the trusted edge. Production outside Vercel requires an explicit trusted proxy.
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : process.env.NODE_ENV !== "production" ? "local-development" : null;
  if (!ip) throw new FaucetError("connection-unverified", "The faucet could not verify this connection.", 503);
  const ipHash = createHmac("sha256", config.key).update(`agari-faucet-ip:${ip}`).digest("hex");
  return { service: createFaucetService(config.chain), ipHash, origin };
}
export function faucetErrorResponse(error: unknown): Response {
  if (error instanceof FaucetError) return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus, headers: { "Cache-Control": "no-store" } });
  // RPC/provider errors may contain connection details. Never serialize them into the public response.
  return Response.json({ error: "The fee service could not finish checking this request. Any saved transfer remains recoverable. Please retry.", code: "service-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
export async function faucetBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) throw new FaucetError("body-large", "Request is too large.", 413);
  const body = await request.text();
  if (body.length > 8192) throw new FaucetError("body-large", "Request is too large.", 413);
  try { return JSON.parse(body); } catch { throw new FaucetError("body-invalid", "Request is not valid JSON.", 400); }
}
