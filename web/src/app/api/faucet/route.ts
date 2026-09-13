import { z } from "zod";
import { FaucetError } from "@masayume/core/faucet";
import { createFaucetService } from "@/features/funding/faucet-service.server";
import { faucetBody, faucetConfig, faucetErrorResponse, faucetForRequest, unavailableFaucetStatus } from "@/features/funding/faucet-config.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const walletSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s.toLowerCase());
const claimSchema = z.object({ id: z.uuid(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(4096) });

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
  } catch { return Response.json(unavailableFaucetStatus(address, "Gas balances could not be checked. Please retry or use an external faucet."), { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

export async function POST(request: Request) {
  try {
    const { service, ipHash } = faucetForRequest(request);
    const parsed = claimSchema.safeParse(await faucetBody(request));
    if (!parsed.success) throw new FaucetError("request-invalid", "Invalid gas request.", 400);
    const claim = await service.claim(parsed.data.id, parsed.data.signature, ipHash);
    return Response.json({ claim }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return faucetErrorResponse(error); }
}
