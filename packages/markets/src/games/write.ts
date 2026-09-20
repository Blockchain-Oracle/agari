import {
  getAdminDistributeSeasonInstructionAsync, getAgentPlacePickInstructionAsync, getPlayerAuthorizeAgentInstructionAsync, getPlayerCancelMatchInstructionAsync,
  getPlayerCreateMatchInstructionAsync, getPlayerJoinMatchInstructionAsync, getPlayerPlacePickInstructionAsync, getPublicClaimCreditInstructionAsync,
  getPublicFinalizeInstructionAsync, getPublicLockPicksInstructionAsync, getPublicRefundUnjoinedInstructionAsync, getPublicRefundUnrevealedInstructionAsync,
  getPublicReleaseAgentInstructionAsync, getPublicRevealDeckInstructionAsync, getPublicSettleCardInstructionAsync,
} from "@agari/clients/agari-arena";
import type { ArenaAgentGrant, ArenaIntent } from "@agari/core/games";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type Diagnosis, type Hash32, type MarketId, type Signature } from "@agari/core/types";
import { getTransferSolInstruction } from "@solana-program/system";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AccountRole, type Instruction, type TransactionSigner } from "@solana/kit";
import { createDeployClient } from "../deploy/client";
import { send } from "../deploy/send";
import { diagnose } from "../errors/error-map";
import { readMarket, readSeries } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { submitLaneWrite } from "../submitter/lane-write";
import { signSendConfirm, type WriteContext } from "../submitter/settle-write";
import { buildWrite } from "../submitter/steps/message";
import { arenaProgramId, creditAddress, idBytes, kit, seasonAddress, seasonVaultAddress } from "./deployment";
import { arenaEventsOf } from "./events";
import { getArenaMatch, readArena } from "./read";

/** What one confirmed pick actually did, straight off the arena's own fill event. */
export type ArenaPickOutcome =
  | { status: "confirmed"; txHash: Signature; quantity: bigint; costBase: bigint; refundBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Signature }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Signature };

const config = () => ({ programAddress: kit(arenaProgramId()) });

async function arenaOrRefuse() {
  const arena = await readArena();
  if (!arena) throw new OrderRefusedError(diagnosis("not-deployed", "no arena on this cluster"));
  return arena;
}

const tokenOf = async (owner: Address, mint: string) => (await findAssociatedTokenPda({ owner: kit(owner), mint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];

/** One card's engine accounts, read from the Market itself. */
async function engineOf(marketId: MarketId) {
  const market = await readMarket(marketId);
  if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  const { data } = market;
  return { series: kit(data.series as unknown as string), market: kit(marketId), book: kit(data.book as unknown as string), ledger: kit(data.ledger as unknown as string), mvault: kit(data.mvault as unknown as string), seriesAddress: data.series };
}

async function matchOrRefuse(matchId: Hash32) {
  const view = await getArenaMatch(matchId);
  if (!view.ok || !view.value) throw new OrderRefusedError(diagnosis("not-settled", `no match ${matchId}`));
  return view.value;
}

/**
 * An entry that names the seat's key is three instructions in one transaction (D-118): the entry, the key's escrow
 * of the deck's ceiling, and its fee money as a plain System transfer. `gasWei` keeps its product name and carries lamports.
 */
async function withAgent(signer: TransactionSigner, playerToken: string, mint: string, matchId: Hash32, grant: ArenaAgentGrant | undefined): Promise<Instruction[]> {
  if (!grant) return [];
  const authorize = await getPlayerAuthorizeAgentInstructionAsync({ player: signer, playerToken: kit(playerToken), collateralMint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS, matchId: idBytes(matchId), agent: kit(grant.agent), ttlSec: grant.ttlSec }, config());
  const fee = grant.gasWei > 0n ? [getTransferSolInstruction({ source: signer, destination: kit(grant.agent), amount: grant.gasWei })] : [];
  return [authorize, ...fee];
}

type LaneIntent = Exclude<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>;

async function instructionsFor(ctx: WriteContext, intent: LaneIntent): Promise<Instruction[]> {
  const arena = await arenaOrRefuse();
  const mint = arena.data.collateralMint as string;
  const shared = { collateralMint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS };

  if (intent.kind === "arena-create") {
    const token = await tokenOf(ctx.wallet, mint);
    const create = await getPlayerCreateMatchInstructionAsync({ ...shared, creator: ctx.signer, creatorToken: token, matchId: idBytes(intent.matchId), challenger: kit(intent.challenger), tier: intent.tier, deckHash: idBytes(intent.deckHash), deckSize: intent.deckSize, policyVersion: intent.policyVersion }, config());
    return [create, ...(await withAgent(ctx.signer, token, mint, intent.matchId, intent.agent))];
  }
  if (intent.kind === "arena-join") {
    const token = await tokenOf(ctx.wallet, mint);
    const join = await getPlayerJoinMatchInstructionAsync({ ...shared, challenger: ctx.signer, challengerToken: token, matchId: idBytes(intent.matchId) }, config());
    return [join, ...(await withAgent(ctx.signer, token, mint, intent.matchId, intent.agent))];
  }
  if (intent.kind === "arena-authorize") {
    // Revoking is releasing: what the key never spent becomes the player's credit, and the key is spent.
    if (intent.agent === null) return [await getPublicReleaseAgentInstructionAsync({ caller: ctx.signer, player: kit(ctx.wallet), matchId: idBytes(intent.matchId) }, config())];
    const match = await matchOrRefuse(intent.matchId);
    return withAgent(ctx.signer, await tokenOf(ctx.wallet, mint), mint, intent.matchId, { agent: intent.agent, ttlSec: intent.ttlSec, budgetBase: match.match.perCardCapBase * BigInt(match.match.deckSize), gasWei: 0n });
  }
  if (intent.kind === "arena-release-agent") {
    return [await getPublicReleaseAgentInstructionAsync({ caller: ctx.signer, player: kit(intent.player), matchId: idBytes(intent.matchId) }, config())];
  }
  if (intent.kind === "arena-reveal") {
    // The cards ARE the Market accounts, handed in after the named ones, in deck order.
    const reveal = await getPublicRevealDeckInstructionAsync({ caller: ctx.signer, matchId: idBytes(intent.matchId), serverSeed: idBytes(intent.serverSeed), clientSeeds: intent.clientSeeds.map(idBytes) }, config());
    return [{ ...reveal, accounts: [...(reveal.accounts ?? []), ...intent.cards.map((card) => ({ address: kit(card), role: AccountRole.READONLY }))] }];
  }
  if (intent.kind === "arena-claim") {
    // The destination has to exist to be paid; whoever cranks the claim pays to create it, and it is still the player's.
    const create = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: kit(intent.player), mint: kit(mint) });
    return [create, await getPublicClaimCreditInstructionAsync({ ...shared, caller: ctx.signer, player: kit(intent.player), playerToken: await tokenOf(intent.player, mint) }, config())];
  }

  const match = await matchOrRefuse(intent.matchId);
  const credits = { creatorCredit: kit(await creditAddress(match.match.creator)), challengerCredit: kit(await creditAddress(match.match.challenger)) };
  const base = { caller: ctx.signer, matchId: idBytes(intent.matchId), ...credits };
  if (intent.kind === "arena-lock") return [await getPublicLockPicksInstructionAsync(base, config())];
  if (intent.kind === "arena-finalize") return [await getPublicFinalizeInstructionAsync(base, config())];
  if (intent.kind === "arena-cancel") return [await getPlayerCancelMatchInstructionAsync(base, config())];
  if (intent.kind === "arena-refund-unjoined") return [await getPublicRefundUnjoinedInstructionAsync(base, config())];
  if (intent.kind === "arena-refund-unrevealed") return [await getPublicRefundUnrevealedInstructionAsync(base, config())];

  const card = match.cards[intent.cardIndex];
  if (!card) throw new OrderRefusedError(diagnosis("not-settled", `match ${intent.matchId} has no card ${intent.cardIndex}`));
  const { book: _book, seriesAddress: _series, ...engine } = await engineOf(card);
  return [await getPublicSettleCardInstructionAsync({ ...shared, ...base, ...engine, cardIndex: intent.cardIndex }, config())];
}

/** Every arena write but a pick, through the session's queued lane. The permissionless ones pay only the players the match names. */
export function submitArenaTx(ctx: WriteContext, intent: LaneIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return submitLaneWrite(ctx, intent.kind, () => instructionsFor(ctx, intent), onPhase);
}

/**
 * One card, one side, one IOC. The wallet's own pick and the seat key's pick are the same record with the same money
 * behind it; what differs is who signs and where the stake comes from. The outcome is what the chain says filled,
 * read from the arena's own `PickFilled` event in the landed transaction, never the quote.
 */
export async function submitArenaPickWrite(ctx: WriteContext, intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>, onPhase?: PhaseListener): Promise<ArenaPickOutcome> {
  try {
    const arena = await arenaOrRefuse();
    const mint = arena.data.collateralMint as string;
    const match = await matchOrRefuse(intent.matchId);
    const card = match.cards[intent.cardIndex];
    if (!card) throw new OrderRefusedError(diagnosis("market-not-trading", `match ${intent.matchId} has no card ${intent.cardIndex}`));
    const { seriesAddress, ...engine } = await engineOf(card);
    const { lotBase } = await readSeries(seriesAddress);
    const args = { ...engine, collateralMint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS, matchId: idBytes(intent.matchId), cardIndex: intent.cardIndex, outcome: intent.pick === "up" ? 0 : 1, stakeBase: intent.stakeBase, minLots: intent.minQuantityRaw / lotBase };
    const instruction = intent.kind === "arena-pick"
      ? await getPlayerPlacePickInstructionAsync({ ...args, player: ctx.signer, playerToken: await tokenOf(ctx.wallet, mint) }, config())
      : await getAgentPlacePickInstructionAsync({ ...args, agent: ctx.signer, player: kit(intent.player) }, config());
    const built = await buildWrite(ctx.rpc, ctx.signer, [instruction]);

    const record = await ctx.journal.record({ kind: "order", wallet: ctx.wallet, summary: `duel pick: card ${intent.cardIndex + 1} ${intent.pick}`, marketId: card });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") return pickRefusal(settled.error);
    const txHash = settled.signature as Signature;
    if (settled.kind === "unknown") return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash });

    const tx = await solana().rpc.getTransaction(txHash as never, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send();
    const filled = arenaEventsOf(tx?.meta?.logMessages ?? [], arenaProgramId()).find((e) => e.kind === "picked");
    if (filled?.kind === "picked") return { status: "confirmed", txHash, quantity: filled.quantity, costBase: filled.costBase, refundBase: filled.refundBase };
    // Landed, and the logs could not be read back: the pick is on chain, and the match read will show its figures.
    return { status: "confirmed", txHash, quantity: 0n, costBase: 0n, refundBase: 0n };
  } catch (error) {
    return pickRefusal(error);
  }
}

function pickRefusal(error: unknown): ArenaPickOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}

export interface DistributeSeasonInput {
  /** The season admin role's 64-byte Solana keypair. */
  secretKey: Uint8Array;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  seasonId: string;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
}

/** The admin's one write: pay the winners and lock the pool. Each winner is paid to their own token account, created if missing. */
export async function distributeSeasonPrizes(input: DistributeSeasonInput): Promise<Signature> {
  if (input.winners.length === 0 || input.winners.length !== input.amountsBase.length) throw new Error("winners and amounts differ in number, or there are none");
  const arena = await readArena();
  if (!arena) throw new Error("no arena on this cluster");
  const mint = arena.data.collateralMint as string;
  const client = await createDeployClient({ rpcUrl: input.rpcUrl, rpcSubscriptionsUrl: input.rpcSubscriptionsUrl, payerSecret: input.secretKey });
  const season = await seasonAddress(input.seasonId);
  const tokens = await Promise.all(input.winners.map((winner) => tokenOf(winner, mint)));
  const creates = await Promise.all(input.winners.map((winner) => getCreateAssociatedTokenIdempotentInstructionAsync({ payer: client.payer, owner: kit(winner), mint: kit(mint) })));
  const distribute = await getAdminDistributeSeasonInstructionAsync({ admin: client.payer, season: kit(season), vault: kit(await seasonVaultAddress(season)), collateralMint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS, amountsBase: [...input.amountsBase] }, config());
  const withWinners: Instruction = { ...distribute, accounts: [...(distribute.accounts ?? []), ...tokens.map((address) => ({ address, role: AccountRole.WRITABLE }))] };
  return (await send({ client, log: () => undefined }, "distribute season", [...creates, withWinners], `${input.winners.length} winners of ${input.seasonId}`)) as Signature;
}
