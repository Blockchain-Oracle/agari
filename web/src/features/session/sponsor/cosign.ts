import { encodeBase58 } from "@agari/core/types";
import { checkChain, SponsorRpcError, type SponsorRpc } from "./chain";
import { NO_DEVICE, type GateLimits, type SponsorLedger } from "./gates";
import { checkStatic, type Refusal, type StaticLimits } from "./policy";
import { base64Bytes, toBase64, withSignature } from "./wire";

/**
 * The fee-payer co-sign (tap-trading.md §3, D-065): policy checks 1–9 in order, then the sponsor's signature in slot 0,
 * a `sponsor_cosigns` row, and the fully signed bytes back to the client. The server never sends: a lost response
 * means nothing reached the chain, and the client journals `markSent` before it sends.
 */
export interface SponsorSigner {
  address: string;
  /** Ed25519 over exactly these bytes; 64 bytes back. */
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface SponsorLimits extends StaticLimits, GateLimits {
  maxFeeLamports: bigint;
}

export interface CosignDeps {
  signer: SponsorSigner;
  /** The agari-vault program id of the resolved deployment. */
  vaultProgram: string;
  limits: SponsorLimits;
  rpc: SponsorRpc;
  ledger: SponsorLedger;
  nowMs: () => number;
}

export interface CosignRequest {
  body: unknown;
  device: string;
}

export interface CosignAccepted {
  ok: true;
  signature: string;
  transaction: string;
  instruction: string;
}

const refuse = (status: Refusal["status"], error: string): Refusal => ({ ok: false, status, error });

function blockHeightOf(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d{1,19}$/.test(value)) return BigInt(value);
  return null;
}

export async function cosign(deps: CosignDeps, request: CosignRequest): Promise<CosignAccepted | Refusal> {
  const { signer, limits } = deps;
  const body = request.body as { transaction?: unknown; lastValidBlockHeight?: unknown } | null;
  const wire = base64Bytes(body?.transaction);
  const lastValidBlockHeight = blockHeightOf(body?.lastValidBlockHeight);
  if (!wire || lastValidBlockHeight === null) return refuse(400, "expected { transaction: base64, lastValidBlockHeight }");

  const pass = await checkStatic(wire, signer.address, deps.vaultProgram, limits);
  if (!pass.ok) return pass;

  // Gates are check 9, but a request with no device can never pass one, so it spends no RPC.
  if (!request.device) return NO_DEVICE;

  let chain: Awaited<ReturnType<typeof checkChain>>;
  try {
    chain = await checkChain(deps.rpc, pass, wire, signer.address, lastValidBlockHeight, limits.maxFeeLamports, limits.maxComputeUnits);
  } catch (error) {
    if (error instanceof SponsorRpcError) return refuse(502, error.message);
    throw error;
  }
  if (!chain.ok) return chain;

  const sponsorSignature = await signer.sign(pass.decoded.messageBytes);
  const signature = encodeBase58(sponsorSignature);
  const instruction = `agari_vault:${pass.instruction}`;
  const row = { signature, signer: pass.signer, device: request.device, instruction, feeLamports: chain.feeLamports, lastValidBlockHeight, createdAtMs: deps.nowMs() };
  const admitted = await deps.ledger.admit(row, limits, chain.sponsorBalanceLamports);
  // A refused co-sign's signature is dropped here and never leaves the server.
  if (!admitted.ok) return admitted;

  return { ok: true, signature, transaction: toBase64(withSignature(wire, pass.decoded, 0, sponsorSignature)), instruction };
}
