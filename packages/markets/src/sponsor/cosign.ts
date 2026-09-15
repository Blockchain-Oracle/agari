/**
 * The fee-payer co-sign (tap-trading.md §3, D-065): policy checks 1–9 in order, then the sponsor's signature in its own
 * slot (Kit's `partiallySignTransaction`), a `sponsor_cosigns` row, and the fully signed bytes back to the client.
 * Nothing here sends: a lost response means nothing reached the chain, and the client journals `markSent` first.
 */
import { createKeyPairFromBytes, getBase64EncodedWireTransaction, getBase64Encoder, getSignatureFromTransaction, partiallySignTransaction, type Address } from "@solana/kit";
import { checkChain, SponsorRpcError, type SponsorRpc } from "./chain";
import type { AttemptLimiter, AttemptLimits, GateLimits, SponsorLedger } from "./gates";
import { checkStatic, refuse, type Refusal, type StaticLimits } from "./policy";

/** WebCrypto's `CryptoKeyPair`, named through Kit so consumers without the DOM lib (services/ops) still typecheck. */
export type SponsorKeyPair = Awaited<ReturnType<typeof createKeyPairFromBytes>>;

export interface SponsorLimits extends StaticLimits, GateLimits, AttemptLimits {
  maxFeeLamports: bigint;
}

export interface CosignDeps {
  /** The sponsor role's key pair (non-extractable) and its address. */
  keyPair: SponsorKeyPair;
  sponsor: Address;
  /** The agari-vault program id of the resolved deployment. */
  vaultProgram: Address;
  limits: SponsorLimits;
  rpc: SponsorRpc;
  ledger: SponsorLedger;
  attempts: AttemptLimiter;
  nowMs: () => number;
}

export interface CosignRequest {
  /** `{ transaction: base64, lastValidBlockHeight }` exactly as posted. */
  body: unknown;
  /** `x-agari-device`; empty refuses. */
  device: string;
  /** The first `x-forwarded-for` hop, "" when absent (proxy trust is S16's). */
  ip: string;
}

export interface CosignAccepted {
  ok: true;
  signature: string;
  transaction: string;
  instruction: string;
}

/** One packet (1,232 B) of base64. */
const MAX_WIRE_BASE64 = 1_644;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function wireOf(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_WIRE_BASE64 || !BASE64.test(value)) return null;
  return new Uint8Array(getBase64Encoder().encode(value));
}

function blockHeightOf(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d{1,19}$/.test(value)) return BigInt(value);
  return null;
}

export async function cosign(deps: CosignDeps, request: CosignRequest): Promise<CosignAccepted | Refusal> {
  const { limits, sponsor } = deps;
  // Attempts first: nothing below (decoding, signature checks, five RPC reads) runs for a device or address over its minute.
  const attempt = deps.attempts.admit(request.device, request.ip, deps.nowMs(), limits);
  if (!attempt.ok) return attempt;

  const body = request.body as { transaction?: unknown; lastValidBlockHeight?: unknown } | null;
  const wire = wireOf(body?.transaction);
  const lastValidBlockHeight = blockHeightOf(body?.lastValidBlockHeight);
  if (!wire || lastValidBlockHeight === null) return refuse(400, "expected { transaction: base64, lastValidBlockHeight }");

  const pass = await checkStatic(wire, sponsor, deps.vaultProgram, limits);
  if (!pass.ok) return pass;

  let chain: Awaited<ReturnType<typeof checkChain>>;
  try {
    chain = await checkChain(deps.rpc, pass, sponsor, lastValidBlockHeight, limits.maxFeeLamports, limits.maxComputeUnits);
  } catch (error) {
    if (error instanceof SponsorRpcError) return refuse(502, error.message);
    throw error;
  }
  if (!chain.ok) return chain;

  const signed = await partiallySignTransaction([deps.keyPair], pass.transaction);
  const signature = getSignatureFromTransaction(signed) as string;
  const instruction = `agari_vault:${pass.instruction}`;
  const row = { signature, signer: pass.signer, device: request.device, instruction, feeLamports: chain.feeLamports, lastValidBlockHeight, createdAtMs: deps.nowMs() };
  const admitted = await deps.ledger.admit(row, limits, chain.sponsorBalanceLamports);
  // A refused co-sign's signature is dropped here and never leaves the server.
  if (!admitted.ok) return admitted;

  return { ok: true, signature, transaction: getBase64EncodedWireTransaction(signed), instruction };
}
