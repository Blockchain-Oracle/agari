import { z } from "zod";
import { FaucetError } from "@masayume/core/faucet";
import { faucetBody, faucetErrorResponse, faucetForRequest } from "@/features/funding/faucet-config.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.object({ wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s.toLowerCase()) });
export async function POST(request: Request) {
  try {
    const { service, ipHash, origin } = faucetForRequest(request);
    const parsed = schema.safeParse(await faucetBody(request));
    if (!parsed.success) throw new FaucetError("wallet-invalid", "Connect a valid wallet first.", 400);
    const challenge = await service.challenge(parsed.data.wallet, ipHash, origin);
    return Response.json(challenge, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return faucetErrorResponse(error); }
}
