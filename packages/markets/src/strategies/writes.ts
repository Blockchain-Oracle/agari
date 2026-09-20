import {
  fetchMaybeRegistry, fetchMaybeStrategy, getCreatorDeactivateInstruction, getCreatorPublishInstructionAsync,
  getCreatorSealInstruction, getCreatorUpdateInstruction, getCreatorWriteMetadataInstruction,
  getSubscriberSubscribeInstructionAsync, getSubscriberUnsubscribeInstruction,
} from "@agari/clients/agari-strategy";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { encodeSpec, encodeStrategyMetadata, type StrategyIntent, type StrategyMetadata, type StrategySpec } from "@agari/core/strategies";
import { diagnosis } from "@agari/core/types";
import type { VaultCaps } from "@agari/core/vault";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Instruction } from "@solana/kit";
import { solana } from "../runtime/solana";
import { OrderRefusedError } from "../submitter/errors";
import { laneRefusal, submitLaneWrite } from "../submitter/lane-write";
import type { WriteContext } from "../submitter/settle-write";
import { grantAddress, tickBaseOf } from "../vault/accounts";
import { kit, registryAddress, strategyAddress, strategyProgramId, subscriptionAddress } from "./deployment";

/** What `agari-strategy` gives every Strategy account (`MAX_METADATA_LEN`). */
export const STRATEGY_METADATA_MAX_BYTES = 2_048;
/**
 * How much of the metadata rides in each transaction. A publish carries the runner, two hashes, the envelope and six
 * account keys beside it, which leaves about 770 bytes of a 1,232-byte transaction; a later write carries far less
 * and has room for about 960. Both sit a little under, so a seal can share the last transaction.
 */
const FIRST_CHUNK_BYTES = 700;
const NEXT_CHUNK_BYTES = 900;
const COLLATERAL_DECIMALS = 6;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

interface RevisionPlan {
  revision: { specHash: Uint8Array; metadataHash: Uint8Array; metadataLen: number; firstChunk: Uint8Array; subscriptionFeeBase: bigint };
  /** The pieces that follow the first, with where each goes. */
  rest: { offset: number; chunk: Uint8Array }[];
}

/** The creator's words as the program takes them: hashed whole, declared by length, and cut to fit transactions. */
export async function planRevision(spec: StrategySpec, metadata: StrategyMetadata, feeBase: bigint): Promise<RevisionPlan> {
  const text = new TextEncoder().encode(encodeStrategyMetadata(metadata));
  if (text.length === 0 || text.length > STRATEGY_METADATA_MAX_BYTES) {
    throw new OrderRefusedError(diagnosis("contract-revert", `the strategy's name, description and spec come to ${text.length} bytes; a strategy holds ${STRATEGY_METADATA_MAX_BYTES}`));
  }
  const rest: RevisionPlan["rest"] = [];
  for (let offset = FIRST_CHUNK_BYTES; offset < text.length; offset += NEXT_CHUNK_BYTES) rest.push({ offset, chunk: text.slice(offset, offset + NEXT_CHUNK_BYTES) });
  return {
    revision: {
      specHash: await sha256(new TextEncoder().encode(encodeSpec(spec))),
      metadataHash: await sha256(text),
      metadataLen: text.length,
      firstChunk: text.slice(0, FIRST_CHUNK_BYTES),
      subscriptionFeeBase: feeBase,
    },
    rest,
  };
}

/** Port caps → the program's envelope: base units as they are, the price ceiling in own-side ticks (0 = none). */
function envelopeOf(caps: VaultCaps) {
  const tickBase = tickBaseOf(COLLATERAL_DECIMALS);
  if (caps.maxPriceRaw % tickBase !== 0n) throw new OrderRefusedError(diagnosis("invalid-price", `price ceiling ${caps.maxPriceRaw} is not a whole number of ticks`));
  return { maxStakePerTrade: caps.maxStakePerTradeBase, maxDailySpend: caps.maxDailySpendBase, maxOpenPositions: caps.maxOpenPositions, maxPriceTicks: Number(caps.maxPriceRaw / tickBase) };
}

/**
 * The transactions one intent takes, in order. Everything but a publish or an update with long text is one. The
 * seal always shares the transaction that writes the last piece, so a strategy is never left whole and unsealed.
 */
async function transactionsFor(ctx: WriteContext, intent: StrategyIntent): Promise<Instruction[][]> {
  const config = { programAddress: kit(strategyProgramId()) };
  const rpc = solana().rpc;

  if (intent.kind === "strategy-publish" || intent.kind === "strategy-update") {
    const plan = await planRevision(intent.spec, intent.metadata, intent.feeBase);
    let strategy: ReturnType<typeof kit>;
    let first: Instruction;
    if (intent.kind === "strategy-publish") {
      const registry = await fetchMaybeRegistry(rpc, kit(await registryAddress()));
      if (!registry.exists) throw new OrderRefusedError(diagnosis("not-deployed", "no strategy registry on this cluster"));
      strategy = kit(await strategyAddress(registry.data.nextStrategyId));
      first = await getCreatorPublishInstructionAsync({ creator: ctx.signer, strategy, runner: kit(intent.runner), envelope: envelopeOf(intent.envelope), revision: plan.revision }, config);
    } else {
      strategy = kit(await strategyAddress(intent.strategyId));
      first = getCreatorUpdateInstruction({ creator: ctx.signer, strategy, revision: plan.revision }, config);
    }
    const seal = getCreatorSealInstruction({ creator: ctx.signer, strategy }, config);
    const writes: Instruction[] = plan.rest.map(({ offset, chunk }) => getCreatorWriteMetadataInstruction({ creator: ctx.signer, strategy, offset, chunk }, config));
    const transactions: Instruction[][] = [[first], ...writes.map((write) => [write])];
    (transactions[transactions.length - 1] as Instruction[]).push(seal);
    return transactions;
  }

  const strategy = kit(await strategyAddress(intent.strategyId));
  if (intent.kind === "strategy-deactivate") return [[getCreatorDeactivateInstruction({ creator: ctx.signer, strategy }, config)]];

  const subscription = kit(await subscriptionAddress(intent.strategyId, ctx.wallet));
  if (intent.kind === "strategy-unsubscribe") return [[getSubscriberUnsubscribeInstruction({ subscriber: ctx.signer, strategy, subscription }, config)]];

  const [record, registry] = await Promise.all([fetchMaybeStrategy(rpc, strategy), fetchMaybeRegistry(rpc, kit(await registryAddress()))]);
  if (!record.exists || !registry.exists) throw new OrderRefusedError(diagnosis("not-deployed", `no strategy ${intent.strategyId}`));
  const mint = registry.data.collateralMint;
  const shared = { subscriber: ctx.signer, strategy, subscription, grant: kit(await grantAddress(intent.grantId)), collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS };
  // `feeBase` is the fee the subscriber was shown. The program refuses a higher one rather than charge it.
  if (record.data.subscriptionFeeBase === 0n) return [[await getSubscriberSubscribeInstructionAsync({ ...shared, maxFeeBase: intent.feeBase }, config)]];

  const [[subscriberToken], [creatorToken]] = await Promise.all([
    findAssociatedTokenPda({ owner: kit(ctx.wallet), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    findAssociatedTokenPda({ owner: record.data.creator, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
  ]);
  // A creator who has never held the collateral has no account to be paid into; the subscriber opens it for them.
  const open = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: record.data.creator, mint });
  return [[open, await getSubscriberSubscribeInstructionAsync({ ...shared, subscriberToken, creatorToken, maxFeeBase: intent.feeBase }, config)]];
}

/**
 * Every registry write. A long publish is two or three transactions and they go in order, each confirmed before the
 * next is built, because a write is simulated against the account the publish created. It stops at the first that
 * does not confirm. A publish abandoned half way leaves a strategy that is visible on chain, unsealed, in no
 * catalogue, and that nobody can subscribe to.
 */
export async function submitStrategyLane(ctx: WriteContext, intent: StrategyIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  let transactions: Instruction[][];
  try {
    transactions = await transactionsFor(ctx, intent);
  } catch (error) {
    return laneRefusal(error);
  }
  let outcome: TxOutcome = { status: "refused", diagnosis: diagnosis("unknown", "nothing to send") };
  for (const instructions of transactions) {
    outcome = await submitLaneWrite(ctx, intent.kind, async () => instructions, onPhase);
    if (outcome.status !== "confirmed") return outcome;
  }
  return outcome;
}
