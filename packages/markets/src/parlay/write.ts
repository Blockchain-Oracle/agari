import { PARLAY_NOT_DEPLOYED, type ParlayIntent } from "@masayume/core/parlay";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, SIDE_TO_OUTCOME, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { erc20Abi, maxUint256, parseEventLogs, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { parlayReserveAbi } from "../contracts/parlay-reserve.abi";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { getParlayDeployment } from "../runtime/read-runtime";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnoseParlay } from "./errors";
import { previewParlayOpen } from "./read";

type ReserveFn = ContractFunctionName<typeof parlayReserveAbi, "nonpayable">;
type Args<F extends ReserveFn> = ContractFunctionArgs<typeof parlayReserveAbi, "nonpayable", F>;

export interface ParlayTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type ParlayOpenOutcome =
  | { status: "confirmed"; txHash: Hex; parlayId: bigint; stakeBase: bigint }
  /** The book moved: the stake this payout now needs is above the one confirmed. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; maxPayoutBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Hex }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Hex };

function reserveAddress(): Address {
  const deployment = getParlayDeployment();
  if (!deployment) throw new Error(PARLAY_NOT_DEPLOYED);
  return deployment.parlayReserve;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** Simulate first — where viem decodes the reserve's custom errors — then send, then wait for the receipt. */
export async function writeReserve<F extends ReserveFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string): Promise<Sent> {
  const address = reserveAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: parlayReserveAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor("parlay") } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The reserve's first ERC-20 allowance is absorbed into the open or supply that needs it (Approvals convention). */
export async function ensureReserveAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  const spender = reserveAddress();
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

function legTuples(intent: Extract<ParlayIntent, { kind: "parlay-open" }>) {
  return intent.legs.map((leg) => ({ marketId: leg.marketId as `0x${string}`, outcomeIdx: SIDE_TO_OUTCOME[leg.side] }));
}

/** One intent, one contract call. Opens and supplies absorb their allowance first. */
export async function sendParlayIntent(contracts: VaultContracts, intent: ParlayIntent): Promise<Sent> {
  switch (intent.kind) {
    case "parlay-open":
      await ensureReserveAllowance(contracts, intent.maxStakeBase);
      return writeReserve(contracts, "openParlay", [legTuples(intent), intent.maxPayoutBase, intent.maxStakeBase], intent.kind);
    case "parlay-resolve-leg":
      return writeReserve(contracts, "resolveLeg", [intent.parlayId, BigInt(intent.legIdx)], intent.kind);
    case "parlay-claim":
      return writeReserve(contracts, "claim", [intent.parlayId], intent.kind);
    case "parlay-supply":
      await ensureReserveAllowance(contracts, intent.amountBase);
      return writeReserve(contracts, "supply", [intent.amountBase], intent.kind);
    case "parlay-withdraw":
      return writeReserve(contracts, "withdraw", [intent.shares], intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeParlay(intent: ParlayIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "parlay-open":
      return `open a ${intent.legs.length}-leg parlay paying ${amount(intent.maxPayoutBase)} for at most ${amount(intent.maxStakeBase)}`;
    case "parlay-resolve-leg":
      return `settle leg ${intent.legIdx + 1} of parlay #${intent.parlayId} on ${intent.marketId}`;
    case "parlay-claim":
      return `claim parlay #${intent.parlayId} for its owner`;
    case "parlay-supply":
      return `supply ${amount(intent.amountBase)} to the parlay reserve`;
    case "parlay-withdraw":
      return `redeem ${intent.shares} reserve shares`;
  }
}

/** What the reserve booked is what its `ParlayOpened` event says: the id and the stake it actually took. */
export function bookParlayOpen(sent: Sent): { parlayId: bigint; stakeBase: bigint } | null {
  const logs = parseEventLogs({ abi: parlayReserveAbi, eventName: "ParlayOpened", logs: sent.receipt.logs });
  const opened = logs[0];
  return opened ? { parlayId: opened.args.parlayId, stakeBase: opened.args.stake } : null;
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The reserve's lane: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitParlayTx(ctx: ParlayTxContext, intent: ParlayIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getParlayDeployment()) return refused(diagnosis("not-deployed", PARLAY_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeParlay(intent, getCollateral().decimals), ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
  const gas = await checkGas(wallet, "parlay");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendParlayIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseParlay);
  }
}

/**
 * The open, with what the surface needs back: the chain is asked for the stake once more before
 * any signature, and a figure above the confirmed one is surfaced as a requote instead of sent
 * (the reserve would refuse it as `StakeAboveMax` anyway — this just spares the popup).
 */
export async function submitParlayOpen(ctx: ParlayTxContext, intent: Extract<ParlayIntent, { kind: "parlay-open" }>, onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  if (!ctx.contracts || !getParlayDeployment()) return { status: "refused", diagnosis: diagnosis("not-deployed", PARLAY_NOT_DEPLOYED) };
  const fresh = await previewParlayOpen(intent.legs, intent.maxPayoutBase);
  if (!fresh.ok) return { status: "refused", diagnosis: fresh.error };
  if (fresh.value.stakeBase > intent.maxStakeBase) return { status: "requote", stakeBase: fresh.value.stakeBase, maxPayoutBase: intent.maxPayoutBase };

  const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: summarizeParlay(intent, getCollateral().decimals) });
  const gas = await checkGas(ctx.wallet, "parlay");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return { status: "refused", diagnosis: gas.diagnosis };
  }
  onPhase?.("submitted");
  try {
    const sent = await sendParlayIntent(ctx.contracts, intent);
    await ctx.journal.markSent(record.id, sent.hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: sent.hash });
    const booked = bookParlayOpen(sent);
    if (!booked) return { status: "unknown", diagnosis: diagnosis("unknown", "the open confirmed but emitted no ParlayOpened event"), txHash: sent.hash };
    return { status: "confirmed", txHash: sent.hash, parlayId: booked.parlayId, stakeBase: booked.stakeBase };
  } catch (error) {
    const failure = await settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseParlay);
    if (failure.status === "confirmed") return { status: "unknown", diagnosis: diagnosis("unknown", "a failed send reported success"), txHash: failure.txHash };
    return failure;
  }
}
