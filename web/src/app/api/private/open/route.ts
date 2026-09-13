import { formatCadence } from "@masayume/core/copy";
import { privateOpenMessage, privateOpenRequestSchema } from "@masayume/core/private";
import { toMarketId } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { getCollateral, marketsProvider } from "@masayume/markets";
import { canonicalSignature, openPrivateBet } from "@masayume/markets/private";
import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getDesk } from "@/features/private/desk.server";
import { gate } from "@/features/session/sponsor.server";

/**
 * Open a private bet. Proof that the caller IS the owner comes first: the route rebuilds the exact message
 * the wallet showed — from the chain's own Window, not the caller's strings — and checks the signature
 * against `owner`. Without this the endpoint would be a faucet for whoever can send a POST.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });
/** A refused open costs the desk sends and the caller nothing, so opens are gated per owner and per address like the sponsor's calls. */
const OPENS_PER_OWNER_PER_HOUR = 20;
const OPENS_PER_IP_PER_HOUR = 60;

export async function POST(req: Request) {
  const parsed = privateOpenRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(400, "malformed private open request");
  const body = parsed.data;
  // One authorisation, one byte form: a malleated twin of the same signature must not become a second slot.
  const signature = canonicalSignature(body.signature as `0x${string}`);
  if (!signature) return refuse(400, "the authorisation signature is not in its canonical form");
  const nowMs = Date.now();
  const byOwner = gate("address", body.owner, OPENS_PER_OWNER_PER_HOUR, nowMs);
  if (!byOwner.ok) return refuse(429, byOwner.reason);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const byIp = gate("device", ip, OPENS_PER_IP_PER_HOUR, nowMs);
  if (!byIp.ok) return refuse(429, byIp.reason);

  const desk = await getDesk().catch(() => null);
  if (!desk) return refuse(503, "no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
  if (!desk.contract) return refuse(503, "PrivateDesk is not deployed on this network yet");
  const market = await marketsProvider.getMarket(toMarketId(body.marketId));
  if (!market.ok) return refuse(502, "could not read the Window right now");
  if (!market.value) return refuse(404, "no such Window");
  const collateral = getCollateral();
  const stakeBase = BigInt(body.stakeBase);
  const message = privateOpenMessage({
    owner: body.owner,
    contract: desk.contract,
    chainId: desk.chainId,
    marketId: market.value.marketId,
    asset: market.value.asset,
    cadenceText: formatCadence(market.value.intervalSec),
    expirySec: market.value.expirySec,
    side: body.side,
    // Exact to the base unit, so the prompt and the charge can never differ by what a rounding hid.
    stakeText: formatBaseUnits(stakeBase, collateral.decimals, { maxDp: collateral.decimals, minDp: 0, group: false }),
    symbol: collateral.symbol,
    issuedAtMs: body.issuedAtMs,
  });
  const authorised = await verifyMessage({ address: body.owner, message, signature }).catch(() => false);
  if (!authorised) return refuse(401, "authorisation was not signed by the owner");

  const result = await openPrivateBet(desk, {
    owner: body.owner,
    marketId: market.value.marketId,
    side: body.side,
    stakeBase,
    minQuantityRaw: BigInt(body.minQuantityRaw),
    authSignature: signature,
    issuedAtMs: body.issuedAtMs,
    asset: market.value.asset,
    intervalSec: market.value.intervalSec,
    expirySec: market.value.expirySec,
  });
  return NextResponse.json(result);
}
