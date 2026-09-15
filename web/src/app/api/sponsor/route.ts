import type { Address } from "@agari/core/types";
import { createSponsorService, type SponsorService } from "@agari/markets/sponsor";
import { NextResponse } from "next/server";
import { marketsEnvFromProcess, vaultDeploymentFromProcess } from "@/features/session/sponsor.server";
import type { SponsorWire } from "@/features/session/useSponsorStatus";

/**
 * The sponsor rail's server half (tap-trading.md §3, D-065): a fee-payer co-signer, never a sender.
 *
 * GET says whether a sponsor exists, what it will pay for and why not. POST takes a v0 transaction the key (or owner)
 * already signed with the sponsor as fee payer; `@agari/markets/sponsor` runs the policy in order, signs the sponsor's
 * slot and hands the bytes back. The client journals the signature and sends it on its own lane.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const noStore = { "Cache-Control": "no-store" };

let service: SponsorService | null = null;
const sponsor = () => (service ??= createSponsorService(process.env));
const vaultProgram = (): Address | null => vaultDeploymentFromProcess(marketsEnvFromProcess())?.eventVault ?? null;

export async function GET() {
  const status = await sponsor().status(vaultProgram());
  const wire: SponsorWire = {
    configured: status.configured,
    sponsor: status.sponsor,
    balanceLamports: status.balanceLamports === null ? null : status.balanceLamports.toString(),
    allowlist: status.allowlist,
    ...(status.reason ? { reason: status.reason } : {}),
  };
  return NextResponse.json(wire, { headers: noStore });
}

export async function POST(request: Request) {
  const refuse = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refuse(413, "request is too large");
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return refuse(413, "request is too large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, "request is not valid JSON");
  }
  const result = await sponsor().cosign(vaultProgram(), body, request.headers.get("x-agari-device") ?? "");
  if (!result.ok) return refuse(result.status, result.error);
  return NextResponse.json({ signature: result.signature, transaction: result.transaction, instruction: result.instruction }, { headers: noStore });
}
