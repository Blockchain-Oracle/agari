/**
 * Read-only recovery of a grant-scoped vault order (tap-trading.md §1.5; Masayume `vault/recovery.ts`). With a
 * signature, the transaction must hold exactly one `Executed` matching owner, actor, Window, grant and side before its
 * deltas are trusted. Without one, nothing on chain can tell this order from a competing one, so the answer stays
 * `unknown`; absence never authorizes a replay (AD-3).
 */
import { SIDE_TO_OUTCOME, type Address, type MarketId, type Side, type Signature } from "@agari/core/types";
import type { Signature as KitSignature } from "@solana/kit";
import { readMarket, readSeries } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import type { JsonTransaction } from "../submitter/events";
import type { WriteRpc } from "../submitter/steps/message";
import { decodeVaultEvents } from "./events";

export type RecoveredVaultExecution =
  | { status: "unknown" }
  | { status: "reverted"; txHash: Signature }
  | { status: "confirmed"; txHash: Signature; cashDelta: bigint; tokenDelta: bigint; atSec: number; side: Side };

/** What an actor captured before sending a grant-scoped vault order, to find it again after a lost reply. */
export interface VaultExecutionEvidence {
  owner: Address;
  actor: Address;
  marketId: MarketId;
  grantId: bigint;
  side: Side;
  /** The slot the send started from. */
  fromSlot: bigint;
  txHash: Signature | null;
}

/** The deltas of the one `Executed` in `tx` that is this order's, or `unknown` when there isn't exactly one. */
export async function recoverFromTransaction(input: VaultExecutionEvidence, tx: JsonTransaction): Promise<RecoveredVaultExecution> {
  if (!input.txHash) return { status: "unknown" };
  if (tx.meta?.err) return { status: "reverted", txHash: input.txHash };
  const outcome = SIDE_TO_OUTCOME[input.side];
  const matching = (await decodeVaultEvents(tx)).filter(
    (e) =>
      e.name === "Executed" &&
      e.data.owner === (input.owner as string) &&
      e.data.actor === (input.actor as string) &&
      e.data.market === (input.marketId as string) &&
      e.data.grantId === input.grantId &&
      e.data.outcome === outcome &&
      e.data.isBuy,
  );
  const hit = matching.length === 1 ? matching[0] : undefined;
  if (!hit || hit.name !== "Executed") return { status: "unknown" };
  // `tokenDelta` is in outcome base units, as the port has it: lots × the Window's lot size.
  const market = await readMarket(input.marketId);
  if (!market) return { status: "unknown" };
  const { lotBase } = await readSeries(market.data.series);
  return { status: "confirmed", txHash: input.txHash, cashDelta: hit.data.cashDelta, tokenDelta: hit.data.lotsDelta * lotBase, atSec: Number(hit.data.atSec), side: input.side };
}

export async function recoverVaultExecution(input: VaultExecutionEvidence, rpc: WriteRpc = solana().rpc): Promise<RecoveredVaultExecution> {
  if (!input.txHash) return { status: "unknown" };
  const tx = await rpc
    .getTransaction(input.txHash as string as KitSignature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" })
    .send()
    .catch(() => null);
  return tx ? recoverFromTransaction(input, tx as unknown as JsonTransaction) : { status: "unknown" };
}
