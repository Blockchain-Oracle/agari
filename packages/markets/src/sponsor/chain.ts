/**
 * The sponsor's chain checks, 6–8 of tap-trading.md §3: the blockhash still has room, the fee is within the cap, and a
 * simulation of exactly these bytes succeeds without moving more than the fee out of the sponsor. The port is five
 * reads, so a test drives every refusal without a validator. Server-only.
 */
import { createSolanaRpc, getBase64Decoder, getBase64EncodedWireTransaction, type Address, type Base64EncodedWireTransaction, type Blockhash, type TransactionMessageBytesBase64 } from "@solana/kit";
import { refuse, type Refusal, type StaticPass } from "./policy";

export interface SponsorSimulation {
  err: unknown;
  unitsConsumed: bigint | null;
  /** The sponsor's lamports before and after, from `preBalances`/`postBalances` (index 0 = the fee payer). */
  sponsorPreLamports: bigint | null;
  sponsorPostLamports: bigint | null;
}

export interface SponsorRpc {
  getBlockHeight(): Promise<bigint>;
  isBlockhashValid(blockhash: string): Promise<boolean>;
  /** Null when the message's blockhash has expired. */
  getFeeForMessage(messageBase64: string): Promise<bigint | null>;
  getBalance(address: Address): Promise<bigint>;
  simulate(wire: Base64EncodedWireTransaction, sponsor: Address): Promise<SponsorSimulation>;
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

/** Checks 6–8. An RPC failure throws `SponsorRpcError` (the route answers 502); nothing here signs. */
export async function checkChain(rpc: SponsorRpc, pass: StaticPass, sponsor: Address, lastValidBlockHeight: bigint, maxFeeLamports: bigint, maxComputeUnits: number): Promise<ChainPass | Refusal> {
  const message = getBase64Decoder().decode(pass.transaction.messageBytes);
  const [height, valid, fee, balance] = await Promise.all([rpc.getBlockHeight(), rpc.isBlockhashValid(pass.blockhash), rpc.getFeeForMessage(message), rpc.getBalance(sponsor)]);

  // 6. The blockhash is live, with room to land.
  if (!valid || fee === null) return refuse(409, "the transaction's blockhash has expired; rebuild it");
  if (lastValidBlockHeight - height < MIN_BLOCKS_LEFT) return refuse(409, `fewer than ${MIN_BLOCKS_LEFT} blocks left before the blockhash expires; rebuild it`);

  // 7. The fee this message costs.
  if (fee > maxFeeLamports) return refuse(403, `the fee ${fee} lamports is above the sponsor's ${maxFeeLamports}`);

  // 8. A failed transaction still costs the fee, so it must simulate clean, inside its limit, and take only the fee.
  const simulation = await rpc.simulate(getBase64EncodedWireTransaction(pass.transaction), sponsor);
  if (simulation.err !== null && simulation.err !== undefined) return refuse(409, `the transaction fails in simulation (${JSON.stringify(simulation.err, (_, v) => (typeof v === "bigint" ? v.toString() : v))})`);
  const limit = BigInt(pass.computeUnitLimit ?? maxComputeUnits);
  if (simulation.unitsConsumed === null || simulation.unitsConsumed > limit) return refuse(409, `simulation used ${simulation.unitsConsumed ?? "unknown"} compute units, over the ${limit} limit`);
  const before = simulation.sponsorPreLamports ?? balance;
  const after = simulation.sponsorPostLamports;
  if (after === null || before - after > fee) return refuse(409, "the simulation moves more than the fee out of the sponsor");

  return { ok: true, feeLamports: fee, sponsorBalanceLamports: before };
}

/** Public devnet is slow under load; a hung read fails the request instead of holding it. */
const RPC_TIMEOUT_MS = 7_000;
const COMMITMENT = "confirmed" as const;

/** The port over Kit's RPC, as the faucet's chain uses it. */
export function createSponsorRpc(url: string): SponsorRpc {
  const rpc = createSolanaRpc(url);
  const call = async <T>(method: string, send: (abortSignal: AbortSignal) => Promise<T>): Promise<T> => {
    try {
      return await send(AbortSignal.timeout(RPC_TIMEOUT_MS));
    } catch {
      throw new SponsorRpcError(method);
    }
  };
  return {
    getBlockHeight: () => call("getBlockHeight", (abortSignal) => rpc.getBlockHeight({ commitment: COMMITMENT }).send({ abortSignal })),
    isBlockhashValid: (blockhash) => call("isBlockhashValid", async (abortSignal) => (await rpc.isBlockhashValid(blockhash as Blockhash, { commitment: COMMITMENT }).send({ abortSignal })).value),
    getFeeForMessage: (message) => call("getFeeForMessage", async (abortSignal) => (await rpc.getFeeForMessage(message as TransactionMessageBytesBase64, { commitment: COMMITMENT }).send({ abortSignal })).value),
    getBalance: (address) => call("getBalance", async (abortSignal) => (await rpc.getBalance(address, { commitment: COMMITMENT }).send({ abortSignal })).value),
    simulate: (wire, sponsor) =>
      call("simulateTransaction", async (abortSignal) => {
        const { value } = await rpc
          .simulateTransaction(wire, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: false, commitment: COMMITMENT, accounts: { addresses: [sponsor], encoding: "base64" } })
          .send({ abortSignal });
        return {
          err: value.err,
          unitsConsumed: value.unitsConsumed ?? null,
          sponsorPreLamports: value.preBalances?.[0] ?? null,
          sponsorPostLamports: value.postBalances?.[0] ?? value.accounts[0]?.lamports ?? null,
        };
      }),
  };
}
