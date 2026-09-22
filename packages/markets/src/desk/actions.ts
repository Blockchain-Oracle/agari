/**
 * The operator's four actions on the chain (desk.md §4.2, §4.5), composed on `DeskOperatorClient`: post a reference,
 * buy, sell, checkpoint. Each returns the landed transaction and the desk's events; the runner (C4) then checks the
 * sealed `head` against `chainHead(prev, seq, hash)` before it trusts its own record.
 */
import type { Hash32 } from "@agari/core/types";
import type { Address, KeyPairSigner } from "@solana/kit";
import { deskTokenAccounts } from "./deployment";
import { sealedActionsOf, type SealedAction } from "./history";
import { buyIx, checkpointIx, sellIx } from "./instructions";
import type { JupiterRoute } from "./jupiter-swap";
import type { DeskOperatorClient, DeskSendResult } from "./operator-client";
import { postReferenceInstructions } from "./reference";

export interface PostReferenceAction {
  attestor: KeyPairSigner;
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
}

/** `[ed25519, public_post_reference]` in one transaction, the operator paying. */
export async function postReference(client: DeskOperatorClient, a: PostReferenceAction): Promise<DeskSendResult> {
  const ixs = await postReferenceInstructions({ attestor: a.attestor, payer: client.signer, mint: a.mint, clusterTag: client.clusterTag, tokenPriceE8: a.tokenPriceE8, markPriceE8: a.markPriceE8, multiplierE12: a.multiplierE12, fetchedAtSec: a.fetchedAtSec, programId: client.programId });
  return client.send("post-reference", ixs);
}

export interface SwapAction {
  owner: Address;
  mint: Address;
  /** USDC E6 for a buy; raw tokens for a sell. */
  amountIn: bigint;
  /** The desk's own floor (the gate's `minOut`); the program raises it to the band floor when that is higher. */
  minOut: bigint;
  deadlineSec: number;
  decisionHash: Hash32;
  route: JupiterRoute;
  /** A posted Pyth `PriceUpdateV2` for the name's index feed, when the desk requires one (buys only). */
  priceUpdate?: Address;
  usdcMint?: Address;
  swapProgram?: Address;
}

export interface SwapResult extends DeskSendResult {
  sealed: SealedAction;
}

function sealedOf(result: DeskSendResult, kind: SealedAction["kind"]): SwapResult {
  const sealed = sealedActionsOf(result.events).find((s) => s.kind === kind);
  if (!sealed) throw new Error(`${result.signature} landed without a ${kind} event`);
  return { ...result, sealed };
}

/** The route's re-pointed setup instructions (an idempotent ATA create, paid by the operator) go before the desk's own. */
export async function buy(client: DeskOperatorClient, a: SwapAction): Promise<SwapResult> {
  const ix = await buyIx({ operator: client.signer, owner: a.owner, tokenMint: a.mint, amountIn: a.amountIn, minOut: a.minOut, deadlineSec: a.deadlineSec, decisionHash: a.decisionHash, swapData: a.route.swapData, route: a.route.route, priceUpdate: a.priceUpdate, usdcMint: a.usdcMint, swapProgram: a.swapProgram });
  return sealedOf(await client.send("buy", [...a.route.setupInstructions, ix], { lookupTables: a.route.lookupTables }), "Bought");
}

export async function sell(client: DeskOperatorClient, a: SwapAction): Promise<SwapResult> {
  const ix = await sellIx({ operator: client.signer, owner: a.owner, tokenMint: a.mint, amountIn: a.amountIn, minOut: a.minOut, deadlineSec: a.deadlineSec, decisionHash: a.decisionHash, swapData: a.route.swapData, route: a.route.route, priceUpdate: a.priceUpdate, usdcMint: a.usdcMint, swapProgram: a.swapProgram });
  return sealedOf(await client.send("sell", [...a.route.setupInstructions, ix], { lookupTables: a.route.lookupTables }), "Sold");
}

export interface CheckpointAction {
  owner: Address;
  deadlineSec: number;
  decisionHash: Hash32;
}

export async function checkpoint(client: DeskOperatorClient, a: CheckpointAction): Promise<SwapResult> {
  const ix = await checkpointIx(client.signer, a.owner, a.deadlineSec, a.decisionHash);
  return sealedOf(await client.send("checkpoint", [ix]), "Checkpoint");
}

/** The desk's two token accounts a route reads and writes, for `swapInstructions`' `destinationTokenAccount`. */
export async function swapAccountsOf(desk: Address, mint: Address, usdcMint?: Address): Promise<{ deskUsdc: Address; deskToken: Address }> {
  return deskTokenAccounts(desk, mint, usdcMint);
}
