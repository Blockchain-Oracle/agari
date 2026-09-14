import { z } from "zod";
import { messageSignatureSchema } from "@agari/core/auth";
import { FAUCET_ASSETS, FaucetError } from "@agari/core/faucet";
import { addressSchema } from "@agari/core/types";
import { createFaucetService } from "@/features/funding/faucet-service.server";
import { faucetBody, faucetConfig, faucetErrorResponse, faucetForRequest, unavailableFaucetStatus } from "@/features/funding/faucet-config.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
/** Base58 is case-sensitive: wallets and message signatures are kept exactly as sent (D-010, D-012). */
const walletSchema = addressSchema;
/** One challenge signature claims each asset once (D-034); `asset` defaults to the SOL top-up. */
const claimSchema = z.object({ id: z.uuid(), signature: messageSignatureSchema, asset: z.enum(FAUCET_ASSETS).default("sol") });

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("wallet");
  const wallet = raw === null ? null : walletSchema.safeParse(raw);
  if (wallet && !wallet.success) return Response.json({ error: "Invalid wallet address." }, { status: 400 });
  let address: string | null = null;
  try {
    const config = faucetConfig();
    address = config?.chain.address ?? null;
    const status = config?.enabled ? await createFaucetService(config.chain).status(wallet?.success ? wallet.data : null) : unavailableFaucetStatus(address);
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json(unavailableFaucetStatus(address, "Balances could not be checked. Please retry or use an external SOL faucet."), { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

export async function POST(request: Request) {
  try {
    const { service, ipHash } = faucetForRequest(request);
    const parsed = claimSchema.safeParse(await faucetBody(request));
    if (!parsed.success) throw new FaucetError("request-invalid", "Invalid test funds request.", 400);
    const claim = await service.claim(parsed.data.id, parsed.data.signature, ipHash, parsed.data.asset);
    return Response.json({ claim }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return faucetErrorResponse(error); }
}
