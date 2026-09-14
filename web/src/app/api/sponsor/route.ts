import { NextResponse } from "next/server";
import type { SponsorWire } from "@/features/session/useSponsorStatus";

/**
 * The sponsor rail's server half. On Solana it becomes a fee-payer co-signer with a spending policy (plan P§3.2:
 * exact instruction allowlist, fee payer only, compute and fee caps, simulation before signing, daily budgets).
 * That policy lands with the vault program (S7); until then the route keeps its contract and answers honestly:
 * nothing is sponsored, so a signer pays its own fee (D-015); on devnet the faucet tops up SOL for fees.
 *
 * GET answers with the client's `SponsorWire` shape (lamports, no EIP-2771 forwarder), so the session surfaces render their
 * "no sponsor here" state from real data rather than from a failed parse.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_DEPLOYED = "no sponsor on this deployment yet: agari-vault is not deployed (S7); the signer pays its own fee";

export async function GET() {
  return NextResponse.json({ configured: false, sponsor: null, balanceLamports: null, allowlist: [] } satisfies SponsorWire);
}

export async function POST() {
  return NextResponse.json({ error: NOT_DEPLOYED }, { status: 503 });
}
