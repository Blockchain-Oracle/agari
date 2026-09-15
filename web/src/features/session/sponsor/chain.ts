import { toBase64 } from "./wire";
import type { Refusal, StaticPass } from "./policy";

/**
 * The sponsor's chain checks, 6–8 of tap-trading.md §3: the blockhash still has room, the fee is within the cap, and a
 * simulation of exactly these bytes succeeds without moving more than the fee out of the sponsor. The port is five
 * JSON-RPC reads, so a test drives every refusal without a validator and web never imports Kit.
 */
export interface SponsorSimulation {
  err: unknown;
  unitsConsumed: bigint | null;
  /** The sponsor's lamports before and after, from `preBalances`/`postBalances` when the RPC reports them. */
  sponsorPreLamports: bigint | null;
  sponsorPostLamports: bigint | null;
}

export interface SponsorRpc {
  getBlockHeight(): Promise<bigint>;
  isBlockhashValid(blockhash: string): Promise<boolean>;
  /** Null when the message's blockhash has expired. */
  getFeeForMessage(messageBase64: string): Promise<bigint | null>;
  getBalance(address: string): Promise<bigint>;
  simulate(wireBase64: string, sponsor: string): Promise<SponsorSimulation>;
}

export const MIN_BLOCKS_LEFT = 20n;

export interface ChainPass {
  ok: true;
  feeLamports: bigint;
  sponsorBalanceLamports: bigint;
}

export class SponsorRpcError extends Error {
  constructor(method: string) {
    super(`the sponsor's RPC did not answer ${method}`);
    this.name = "SponsorRpcError";
  }
}

const refuse = (status: Refusal["status"], error: string): Refusal => ({ ok: false, status, error });

/** Checks 6–8. An RPC failure throws `SponsorRpcError` (the route answers 502); nothing here signs. */
export async function checkChain(rpc: SponsorRpc, pass: StaticPass, wire: Uint8Array, sponsor: string, lastValidBlockHeight: bigint, maxFeeLamports: bigint, maxComputeUnits: number): Promise<ChainPass | Refusal> {
  const { decoded } = pass;
  const [height, valid, fee, balance] = await Promise.all([rpc.getBlockHeight(), rpc.isBlockhashValid(decoded.recentBlockhash), rpc.getFeeForMessage(toBase64(decoded.messageBytes)), rpc.getBalance(sponsor)]);

  // 6. The blockhash is live, with room to land.
  if (!valid || fee === null) return refuse(409, "the transaction's blockhash has expired; rebuild it");
  if (lastValidBlockHeight - height < MIN_BLOCKS_LEFT) return refuse(409, `fewer than ${MIN_BLOCKS_LEFT} blocks left before the blockhash expires; rebuild it`);

  // 7. The fee this message costs.
  if (fee > maxFeeLamports) return refuse(403, `the fee ${fee} lamports is above the sponsor's ${maxFeeLamports}`);

  // 8. A failed transaction still costs the fee, so it must simulate clean, inside its limit, and take only the fee.
  const simulation = await rpc.simulate(toBase64(wire), sponsor);
  if (simulation.err !== null && simulation.err !== undefined) return refuse(409, `the transaction fails in simulation (${JSON.stringify(simulation.err)})`);
  const limit = BigInt(pass.computeUnitLimit ?? maxComputeUnits);
  if (simulation.unitsConsumed === null || simulation.unitsConsumed > limit) return refuse(409, `simulation used ${simulation.unitsConsumed ?? "unknown"} compute units, over the ${limit} limit`);
  const before = simulation.sponsorPreLamports ?? balance;
  const after = simulation.sponsorPostLamports;
  if (after === null || before - after > fee) return refuse(409, "the simulation moves more than the fee out of the sponsor");

  return { ok: true, feeLamports: fee, sponsorBalanceLamports: before };
}

const RPC_TIMEOUT_MS = 8_000;
const COMMITMENT = { commitment: "confirmed" } as const;

interface SimulateValue {
  err: unknown;
  unitsConsumed?: number;
  accounts?: ({ lamports: number } | null)[] | null;
  preBalances?: number[] | null;
  postBalances?: number[] | null;
}

/** The port over plain JSON-RPC: lamports arrive as JSON numbers (below 2^53) and become bigints at once. */
export function createSponsorRpc(url: string, fetchImpl: typeof fetch = fetch): SponsorRpc {
  let id = 0;
  async function call<T>(method: string, params: unknown[]): Promise<T> {
    let body: { result?: T; error?: unknown };
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      body = (await response.json()) as typeof body;
    } catch {
      throw new SponsorRpcError(method);
    }
    if (body.error !== undefined || body.result === undefined) throw new SponsorRpcError(method);
    return body.result;
  }
  const big = (value: number | undefined | null) => (typeof value === "number" && Number.isSafeInteger(value) ? BigInt(value) : null);
  return {
    getBlockHeight: async () => BigInt(await call<number>("getBlockHeight", [COMMITMENT])),
    isBlockhashValid: async (blockhash) => (await call<{ value: boolean }>("isBlockhashValid", [blockhash, COMMITMENT])).value,
    getFeeForMessage: async (message) => big((await call<{ value: number | null }>("getFeeForMessage", [message, COMMITMENT])).value),
    getBalance: async (address) => BigInt((await call<{ value: number }>("getBalance", [address, COMMITMENT])).value),
    simulate: async (wire, sponsor) => {
      const { value } = await call<{ value: SimulateValue }>("simulateTransaction", [
        wire,
        { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, ...COMMITMENT, accounts: { addresses: [sponsor], encoding: "base64" } },
      ]);
      return {
        err: value.err ?? null,
        unitsConsumed: big(value.unitsConsumed),
        sponsorPreLamports: big(value.preBalances?.[0]),
        sponsorPostLamports: big(value.postBalances?.[0]) ?? big(value.accounts?.[0]?.lamports),
      };
    },
  };
}
