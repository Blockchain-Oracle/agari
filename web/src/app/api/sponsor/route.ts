import { ensureMarkets, executeSponsored, getClient, sponsorableFunctionOf, SPONSORABLE_FUNCTIONS } from "@masayume/markets";
import type { PublicClient } from "viem";
import { NextResponse } from "next/server";
import { deadlineIsSane, forwardRequestSchema, gate, marketsEnvFromProcess, sponsorConfig, vaultDeploymentFromProcess } from "@/features/session/sponsor.server";

/**
 * The sponsor rail's server half: a relayer that pays gas for what the signer signed, through the
 * ERC-2771 forwarder the vault trusts — the web-hosted form of doc 02's `actors/sponsor`.
 *
 * GET says whether a sponsor exists and what it will pay for. POST takes a signed ForwardRequest,
 * checks the policy (target, selector allowlist, value, gas, deadline, per-address and per-device
 * gates), asks the forwarder to verify it, and only then spends its own STT on `execute`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET() {
  const env = marketsEnvFromProcess();
  ensureMarkets(env);
  const config = sponsorConfig(env);
  const deployment = vaultDeploymentFromProcess(env);
  let balanceWei: bigint | null = null;
  if (config) balanceWei = await getClient().getNativeBalance(config.sponsor).catch(() => null);
  return NextResponse.json({
    configured: config !== null && deployment !== null,
    sponsor: config?.sponsor ?? null,
    balanceWei: balanceWei === null ? null : balanceWei.toString(),
    forwarder: deployment?.forwarder ?? null,
    allowlist: SPONSORABLE_FUNCTIONS,
  });
}

export async function POST(req: Request) {
  const env = marketsEnvFromProcess();
  ensureMarkets(env);
  const config = sponsorConfig(env);
  if (!config) return refuse(503, "no sponsor is configured on this deployment; the signer pays its own gas");
  const deployment = vaultDeploymentFromProcess(env);
  if (!deployment) return refuse(503, "EventVault is not deployed on this network yet");

  const body = (await req.json().catch(() => null)) as { request?: unknown } | null;
  const parsed = forwardRequestSchema.safeParse(body?.request);
  if (!parsed.success) return refuse(400, "malformed forward request");
  const request = parsed.data;
  const nowMs = Date.now();

  if (request.to.toLowerCase() !== deployment.eventVault.toLowerCase()) return refuse(403, "the sponsor pays only for calls into the EventVault");
  const fn = sponsorableFunctionOf(request.data);
  if (!fn) return refuse(403, "that function is not on the sponsor's allowlist — capital intake is never sponsored");
  if (request.value !== "0") return refuse(403, "the sponsor never forwards value");
  if (BigInt(request.gas) > config.maxGas) return refuse(403, `gas above the sponsor's ${config.maxGas} ceiling`);
  if (!deadlineIsSane(request.deadlineSec, Math.floor(nowMs / 1000))) return refuse(403, "deadline is past, or further out than the sponsor accepts");

  const device = req.headers.get("x-masayume-device") ?? "";
  const byDevice = gate("device", device, config.maxPerDevicePerHour, nowMs);
  if (!byDevice.ok) return refuse(429, byDevice.reason);
  const byAddress = gate("address", request.from, config.maxPerAddressPerHour, nowMs);
  if (!byAddress.ok) return refuse(429, byAddress.reason);

  try {
    const hash = await executeSponsored({
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
      forwarder: deployment.forwarder,
      request,
      publicClient: getClient().getViemClient() as PublicClient,
    });
    return NextResponse.json({ hash, function: fn });
  } catch (error) {
    return refuse(502, error instanceof Error ? error.message : "the sponsor could not send");
  }
}
