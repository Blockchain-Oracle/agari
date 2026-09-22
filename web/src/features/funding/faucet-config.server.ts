import { createHmac } from "node:crypto";
import { FaucetError, SOL_FAUCET_POLICY, unavailableTusdcStatus, type FaucetStatus } from "@agari/core/faucet";
import { isDbConfigured } from "@agari/db";
import { createFaucetChain, faucetRoleSecret, type FaucetChain } from "@agari/markets/faucet";
import { createFaucetService } from "./faucet-service.server";
import { clientIp, publicOrigin } from "@/lib/client-ip.server";

let loaded: { keys: { key: string; chain: FaucetChain } | null } | null = null;

/**
 * The devnet faucet's two server keys (D-034): `SOL_FAUCET_PRIVATE_KEY` / `FAUCET_MINT_AUTHORITY_PRIVATE_KEY`, else the
 * role files in `~/.config/agari/devnet/` (`AGARI_KEYS_DIR`). Read once per process so the chain's signers and mint
 * facts are reused. A missing mint authority leaves SOL top-ups working and tUSDC unavailable.
 */
export function faucetConfig() {
  if (!loaded) {
    const funder = faucetRoleSecret("sol-faucet", process.env);
    const chain = funder ? createFaucetChain({ funder, mintAuthority: faucetRoleSecret("faucet-mint-authority", process.env) }, process.env.SOL_FAUCET_RPC_URL) : null;
    // The IP hash keys on the funder's secret bytes, so it can't be recomputed without the server's key.
    loaded = { keys: funder && chain ? { key: Buffer.from(funder).toString("hex"), chain } : null };
  }
  if (!loaded.keys) return null;
  return { ...loaded.keys, enabled: ["1", "true"].includes(process.env.SOL_FAUCET_ENABLED ?? "") && isDbConfigured() };
}
export function unavailableFaucetStatus(address: string | null, message = "In-app test funds are unavailable. You can use an external SOL faucet."): FaucetStatus {
  return { configured: false, ready: false, address, fundingBalanceLamports: null, walletBalanceLamports: null, dailyRemainingLamports: null, targetLamports: SOL_FAUCET_POLICY.targetLamports.toString(), thresholdLamports: SOL_FAUCET_POLICY.thresholdLamports.toString(), claim: null, tusdc: unavailableTusdcStatus(), message };
}
export function faucetForRequest(request: Request) {
  const origin = publicOrigin(request);
  const suppliedOrigin = request.headers.get("origin");
  if (suppliedOrigin && suppliedOrigin !== origin) throw new FaucetError("origin-invalid", "Open the faucet from Agari.", 403);
  const config = faucetConfig();
  if (!config?.enabled) throw new FaucetError("unavailable", "In-app test funds are unavailable. Please use an external SOL faucet.", 503);
  // The proxy named by TRUSTED_PROXY vouches for the IP (client-ip.server.ts); with none named, production refuses.
  const ip = clientIp(request);
  if (!ip) throw new FaucetError("connection-unverified", "The faucet could not verify this connection.", 503);
  const ipHash = createHmac("sha256", config.key).update(`agari-faucet-ip:${ip}`).digest("hex");
  return { service: createFaucetService(config.chain), ipHash, origin };
}
export function faucetErrorResponse(error: unknown): Response {
  if (error instanceof FaucetError) return Response.json({ error: error.message, code: error.code }, { status: error.httpStatus, headers: { "Cache-Control": "no-store" } });
  // RPC/provider errors may contain connection details. Never serialize them into the public response.
  return Response.json({ error: "The faucet could not finish checking this request. Any saved transfer remains recoverable. Please retry.", code: "service-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
export async function faucetBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) throw new FaucetError("body-large", "Request is too large.", 413);
  const body = await request.text();
  if (body.length > 8192) throw new FaucetError("body-large", "Request is too large.", 413);
  try { return JSON.parse(body); } catch { throw new FaucetError("body-invalid", "Request is not valid JSON.", 400); }
}
