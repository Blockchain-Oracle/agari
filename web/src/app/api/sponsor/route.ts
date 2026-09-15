import { VAULT_NOT_DEPLOYED } from "@agari/core/vault";
import { NextResponse } from "next/server";
import { cosignConfig, marketsEnvFromProcess, vaultDeploymentFromProcess } from "@/features/session/sponsor.server";
import { cosign } from "@/features/session/sponsor/cosign";
import { breakerOpen, BREAKER_REASON } from "@/features/session/sponsor/gates";
import { SPONSOR_ALLOWLIST } from "@/features/session/sponsor/policy";
import type { SponsorWire } from "@/features/session/useSponsorStatus";

/**
 * The sponsor rail's server half (tap-trading.md §3, D-065): a fee-payer co-signer, never a sender.
 *
 * GET says whether a sponsor exists, what it will pay for and why not. POST takes a v0 transaction the key (or owner)
 * already signed with the sponsor as fee payer, runs the policy in order (shape, fee payer, signer, instruction
 * allowlist, no privilege lent, blockhash, fee, simulation, gates and breaker), signs slot 0 and returns the bytes.
 * The client journals the signature and sends it on its own lane.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_KEY = "no sponsor key on this server; the session key pays its own fee";
const MAX_BODY_BYTES = 8_192;
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const wire = (configured: boolean, extra: Partial<SponsorWire>): SponsorWire => ({ configured, sponsor: null, balanceLamports: null, allowlist: SPONSOR_ALLOWLIST, ...extra });
  const config = await cosignConfig();
  if (!config) return NextResponse.json(wire(false, { reason: NO_KEY }), { headers: noStore });
  const sponsor = config.sponsor;
  if (!vaultDeploymentFromProcess(marketsEnvFromProcess())) return NextResponse.json(wire(false, { sponsor, reason: VAULT_NOT_DEPLOYED }), { headers: noStore });
  const balance = await config.rpc.getBalance(sponsor).catch(() => null);
  if (balance === null) return NextResponse.json(wire(false, { sponsor, reason: "the sponsor's balance could not be read" }), { headers: noStore });
  const balanceLamports = balance.toString();
  if (breakerOpen(balance, config.limits)) return NextResponse.json(wire(false, { sponsor, balanceLamports, reason: BREAKER_REASON }), { headers: noStore });
  return NextResponse.json(wire(true, { sponsor, balanceLamports, ...(config.ledger.kind === "local" ? { reason: "local counters" } : {}) }), { headers: noStore });
}

export async function POST(request: Request) {
  const refuse = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });
  const config = await cosignConfig();
  if (!config) return refuse(503, NO_KEY);
  const deployment = vaultDeploymentFromProcess(marketsEnvFromProcess());
  if (!deployment) return refuse(503, VAULT_NOT_DEPLOYED);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refuse(413, "request is too large");
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return refuse(413, "request is too large");
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, "request is not valid JSON");
  }

  const result = await cosign(
    { signer: config.signer, vaultProgram: deployment.eventVault, limits: config.limits, rpc: config.rpc, ledger: config.ledger, nowMs: Date.now },
    { body, device: request.headers.get("x-agari-device") ?? "" },
  );
  if (!result.ok) return refuse(result.status, result.error);
  return NextResponse.json({ signature: result.signature, transaction: result.transaction, instruction: result.instruction }, { headers: noStore });
}
