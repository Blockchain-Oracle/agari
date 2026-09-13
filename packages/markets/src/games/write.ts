import { ARENA_NOT_DEPLOYED, arenaIntentSpend, type ArenaIntent } from "@masayume/core/games";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { erc20Abi, maxUint256, parseEventLogs, zeroAddress, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { gameArenaAbi } from "../contracts/game-arena.abi";
import { getArenaDeployment } from "../runtime/read-runtime";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnoseArena } from "./errors";

type ArenaFn = ContractFunctionName<typeof gameArenaAbi, "nonpayable" | "payable">;
type Args<F extends ArenaFn> = ContractFunctionArgs<typeof gameArenaAbi, "nonpayable" | "payable", F>;

export interface ArenaTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/** What one confirmed pick actually did, straight off the arena's own `PickFilled`. */
export type ArenaPickOutcome =
  | { status: "confirmed"; txHash: Hex; quantity: bigint; costBase: bigint; refundBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Hex }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Hex };

function arenaAddress(): Address {
  const deployment = getArenaDeployment();
  if (!deployment) throw new Error(ARENA_NOT_DEPLOYED);
  return deployment.gameArena;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/**
 * Simulate first — where viem decodes the arena's custom errors — then send, then wait for the receipt.
 * `value` rides only on the two payable entries, as the gas an entry hands its key.
 */
export async function writeGameArena<F extends ArenaFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string, value?: bigint): Promise<Sent> {
  const address = arenaAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: gameArenaAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
    ...(value !== undefined && value > 0n ? { value } : {}),
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor("arena") } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The arena's first ERC-20 allowance is absorbed into the pot or pick that needs it (Approvals convention). */
export async function ensureArenaAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  if (amountBase === 0n) return null;
  const spender = arenaAddress();
  const owner = account(contracts);
  const token = getCollateral().address;
  const allowance = await contracts.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  if (allowance >= amountBase) return null;
  const hash = await contracts.walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    account: contracts.walletClient.account ?? owner,
    chain: SOMNIA_SHANNON,
    gas: gasLimitFor("approve"),
  });
  await awaitReceipt(contracts.publicClient, hash, "approve");
  return hash;
}

/** One intent, one contract call. Anything that spends absorbs its allowance first. */
export async function sendArenaIntent(contracts: VaultContracts, intent: ArenaIntent): Promise<Sent> {
  await ensureArenaAllowance(contracts, arenaIntentSpend(intent));
  switch (intent.kind) {
    case "arena-create":
      return intent.agent
        ? writeGameArena(
            contracts,
            "createMatchWithAgent",
            [intent.matchId, intent.challenger, intent.tier, intent.deckHash, intent.deckSize, intent.policyVersion, intent.agent.agent, intent.agent.ttlSec],
            intent.kind,
            intent.agent.gasWei,
          )
        : writeGameArena(
            contracts,
            "createMatch",
            [intent.matchId, intent.challenger, intent.tier, intent.deckHash, intent.deckSize, intent.policyVersion],
            intent.kind,
          );
    case "arena-join":
      return intent.agent
        ? writeGameArena(contracts, "joinMatchWithAgent", [intent.matchId, intent.agent.agent, intent.agent.ttlSec], intent.kind, intent.agent.gasWei)
        : writeGameArena(contracts, "joinMatch", [intent.matchId], intent.kind);
    case "arena-authorize":
      return writeGameArena(contracts, "authorizeAgent", [intent.matchId, intent.agent ?? zeroAddress, intent.ttlSec], intent.kind);
    case "arena-reveal":
      return writeGameArena(
        contracts,
        "revealDeck",
        [intent.matchId, intent.serverSeed, intent.clientSeeds as readonly `0x${string}`[], intent.cards as readonly `0x${string}`[]],
        intent.kind,
      );
    case "arena-pick":
      return writeGameArena(
        contracts,
        "placePick",
        [intent.matchId, intent.cardIndex, intent.pick === "up" ? 0 : 1, intent.stakeBase, intent.minQuantityRaw],
        intent.kind,
      );
    case "arena-pick-for":
      return writeGameArena(
        contracts,
        "placePickFor",
        [intent.player, intent.matchId, intent.cardIndex, intent.pick === "up" ? 0 : 1, intent.stakeBase, intent.minQuantityRaw],
        intent.kind,
      );
    case "arena-lock":
      return writeGameArena(contracts, "lockPicks", [intent.matchId], intent.kind);
    case "arena-settle-card":
      return writeGameArena(contracts, "settleCard", [intent.matchId, intent.cardIndex], intent.kind);
    case "arena-finalize":
      return writeGameArena(contracts, "finalize", [intent.matchId], intent.kind);
    case "arena-cancel":
      return writeGameArena(contracts, "cancelMatch", [intent.matchId], intent.kind);
    case "arena-refund-unjoined":
      return writeGameArena(contracts, "refundUnjoined", [intent.matchId], intent.kind);
    case "arena-refund-unrevealed":
      return writeGameArena(contracts, "refundUnrevealed", [intent.matchId], intent.kind);
    case "arena-claim":
      return writeGameArena(contracts, "claimCredit", [intent.player], intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeArena(intent: ArenaIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "arena-create":
      return `open a ${amount(intent.potBase)} duel against ${intent.challenger} over ${intent.deckSize} cards${intent.agent ? `, key ${intent.agent.agent} swiping` : ""}`;
    case "arena-join":
      return `join duel ${intent.matchId} with a ${amount(intent.potBase)} side-pot${intent.agent ? `, key ${intent.agent.agent} swiping` : ""}`;
    case "arena-authorize":
      return intent.agent ? `name ${intent.agent} to swipe for me in duel ${intent.matchId}` : `revoke my key in duel ${intent.matchId}`;
    case "arena-reveal":
      return `open the deck of ${intent.cards.length} Windows for duel ${intent.matchId}`;
    case "arena-pick":
      return `play card ${intent.cardIndex} ${intent.pick} for at most ${amount(intent.stakeBase)}`;
    case "arena-pick-for":
      return `play card ${intent.cardIndex} ${intent.pick} for ${intent.player}, at most ${amount(intent.stakeBase)}`;
    case "arena-lock":
      return `close the pick window on duel ${intent.matchId}`;
    case "arena-settle-card":
      return `settle card ${intent.cardIndex} of duel ${intent.matchId}`;
    case "arena-finalize":
      return `award the pot of duel ${intent.matchId}`;
    case "arena-cancel":
      return `withdraw duel ${intent.matchId} before anyone joined`;
    case "arena-refund-unjoined":
      return `return the unjoined pot of duel ${intent.matchId}`;
    case "arena-refund-unrevealed":
      return `return both pots of duel ${intent.matchId}, whose deck was never opened`;
    case "arena-claim":
      return `claim what the arena owes ${intent.player}`;
  }
}

/** What the arena booked is what its `PickFilled` event says: the size, the cost and what went back. */
export function bookArenaPick(sent: Sent): { quantity: bigint; costBase: bigint; refundBase: bigint } | null {
  const logs = parseEventLogs({ abi: gameArenaAbi, eventName: "PickFilled", logs: sent.receipt.logs });
  const filled = logs[0];
  return filled ? { quantity: filled.args.quantity, costBase: filled.args.costBase, refundBase: filled.args.refundBase } : null;
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The arena's lane: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitArenaTx(ctx: ArenaTxContext, intent: ArenaIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getArenaDeployment()) return refused(diagnosis("not-deployed", ARENA_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeArena(intent, getCollateral().decimals) });
  const gas = await checkGas(wallet, "arena");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendArenaIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseArena);
  }
}

/** The pick, with what the swipe stage needs back: the size that filled, not the size that was asked for. */
export async function submitArenaPick(
  ctx: ArenaTxContext,
  intent: Extract<ArenaIntent, { kind: "arena-pick" | "arena-pick-for" }>,
  onPhase?: PhaseListener,
): Promise<ArenaPickOutcome> {
  if (!ctx.contracts || !getArenaDeployment()) return { status: "refused", diagnosis: diagnosis("not-deployed", ARENA_NOT_DEPLOYED) };
  const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: summarizeArena(intent, getCollateral().decimals) });
  const gas = await checkGas(ctx.wallet, "arena");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return { status: "refused", diagnosis: gas.diagnosis };
  }
  onPhase?.("submitted");
  try {
    const sent = await sendArenaIntent(ctx.contracts, intent);
    await ctx.journal.markSent(record.id, sent.hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: sent.hash });
    const booked = bookArenaPick(sent);
    if (!booked) return { status: "unknown", diagnosis: diagnosis("unknown", "the pick confirmed but emitted no PickFilled event"), txHash: sent.hash };
    return { status: "confirmed", txHash: sent.hash, ...booked };
  } catch (error) {
    const failure = await settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseArena);
    if (failure.status === "confirmed") return { status: "unknown", diagnosis: diagnosis("unknown", "a failed send reported success"), txHash: failure.txHash };
    return failure;
  }
}
