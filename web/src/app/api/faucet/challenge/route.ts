import { z } from "zod";
import { FaucetError } from "@agari/core/faucet";
import { addressSchema } from "@agari/core/types";
import { regionRestricted, regionRestrictedResponse } from "@/lib/region.server";
import { faucetBody, faucetErrorResponse, faucetForRequest } from "@/features/funding/faucet-config.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Base58 is case-sensitive: the wallet is validated and kept exactly as sent (D-010). */
const schema = z.object({ wallet: addressSchema });
export async function POST(request: Request) {
  // The geofence comes before any key, balance or co-signature (D-095).
  if (regionRestricted(request)) return regionRestrictedResponse();
  try {
    const { service, ipHash, origin } = faucetForRequest(request);
    const parsed = schema.safeParse(await faucetBody(request));
    if (!parsed.success) throw new FaucetError("wallet-invalid", "Connect a valid wallet first.", 400);
    const challenge = await service.challenge(parsed.data.wallet, ipHash, origin);
    return Response.json(challenge, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return faucetErrorResponse(error); }
}
