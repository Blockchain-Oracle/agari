import { NextResponse } from "next/server";

/**
 * The sponsor rail's server half. On Solana it becomes a fee-payer co-signer with a spending policy (plan P§3.2:
 * exact instruction allowlist, fee payer only, compute and fee caps, simulation before signing, daily budgets).
 * That policy lands with the vault program (S7); until then the route keeps its contract and answers honestly:
 * nothing is sponsored, so a signer pays its own fee (D-015). Privy embedded wallets use Privy's own sponsorship.
 *
 * GET keeps Masayume's response keys so the session surfaces render their "no sponsor here" state unchanged.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_DEPLOYED = "no sponsor on this deployment yet: agari-vault is not deployed (S7); the signer pays its own fee";

export async function GET() {
  return NextResponse.json({
    configured: false,
    sponsor: null,
    balanceWei: null,
    forwarder: null,
    allowlist: [],
  });
}

export async function POST() {
  return NextResponse.json({ error: NOT_DEPLOYED }, { status: 503 });
}
