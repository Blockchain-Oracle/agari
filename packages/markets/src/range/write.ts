import { RANGE_NOT_DEPLOYED, rangeSideIndex, type RangeIntent } from "@masayume/core/range";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { erc20Abi, maxUint256, parseEventLogs, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { rangeReserveAbi } from "../contracts/range-reserve.abi";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { getRangeDeployment } from "../runtime/read-runtime";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnoseRange } from "./errors";
import { previewRangeOpen } from "./read";

type ReserveFn = ContractFunctionName<typeof rangeReserveAbi, "nonpayable">;
type Args<F extends ReserveFn> = ContractFunctionArgs<typeof rangeReserveAbi, "nonpayable", F>;
type OpenIntent = Extract<RangeIntent, { kind: "range-open" }>;

export interface RangeTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type RangeOpenOutcome =
  | { status: "confirmed"; txHash: Hex; roundId: bigint; stakeBase: bigint }
  /** The basis moved: the stake this payout now needs is above the one confirmed. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; maxPayoutBase: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Hex }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Hex };

function reserveAddress(): Address {
  const deployment = getRangeDeployment();
  if (!deployment) throw new Error(RANGE_NOT_DEPLOYED);
  return deployment.rangeReserve;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** Simulate first — where viem decodes the reserve's custom errors — then send, then wait for the receipt. */
export async function writeRangeReserve<F extends ReserveFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string): Promise<Sent> {
  const address = reserveAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: rangeReserveAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor("range") } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The reserve's first ERC-20 allowance is absorbed into the open or supply that needs it (Approvals convention). */
export async function ensureRangeAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
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

/** One intent, one contract call. Opens and supplies absorb their allowance first. */
export async function sendRangeIntent(contracts: VaultContracts, intent: RangeIntent): Promise<Sent> {
  switch (intent.kind) {
    case "range-open":
      await ensureRangeAllowance(contracts, intent.maxStakeBase);
      return writeRangeReserve(
        contracts,
        "openRange",
        [intent.marketId as `0x${string}`, intent.asset, rangeSideIndex(intent.side), intent.lowPrint, intent.highPrint, intent.maxPayoutBase, intent.maxStakeBase],
        intent.kind,
      );
    case "range-settle":
      return writeRangeReserve(contracts, "settle", [intent.roundId], intent.kind);
    case "range-void-stale":
      return writeRangeReserve(contracts, "voidStale", [intent.roundId], intent.kind);
    case "range-claim":
      return writeRangeReserve(contracts, "claim", [intent.roundId], intent.kind);
    case "range-supply":
      await ensureRangeAllowance(contracts, intent.amountBase);
      return writeRangeReserve(contracts, "supply", [intent.amountBase], intent.kind);
    case "range-withdraw":
      return writeRangeReserve(contracts, "withdraw", [intent.shares], intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeRange(intent: RangeIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "range-open":
      return `open a ${intent.side} band ${intent.lowPrint}–${intent.highPrint} on ${intent.marketId} paying ${amount(intent.maxPayoutBase)} for at most ${amount(intent.maxStakeBase)}`;
    case "range-settle":
      return `settle range round #${intent.roundId} on ${intent.marketId}`;
    case "range-void-stale":
      return `void stale range round #${intent.roundId}`;
    case "range-claim":
      return `claim range round #${intent.roundId} for its owner`;
    case "range-supply":
      return `supply ${amount(intent.amountBase)} to the range reserve`;
    case "range-withdraw":
      return `redeem ${intent.shares} range reserve shares`;
  }
}

/** What the reserve booked is what its `RangeOpened` event says: the id and the stake it actually took. */
export function bookRangeOpen(sent: Sent): { roundId: bigint; stakeBase: bigint } | null {
  const logs = parseEventLogs({ abi: rangeReserveAbi, eventName: "RangeOpened", logs: sent.receipt.logs });
  const opened = logs[0];
  return opened ? { roundId: opened.args.roundId, stakeBase: opened.args.stake } : null;
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The reserve's lane: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitRangeTx(ctx: RangeTxContext, intent: RangeIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getRangeDeployment()) return refused(diagnosis("not-deployed", RANGE_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeRange(intent, getCollateral().decimals), ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
  const gas = await checkGas(wallet, "range");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendRangeIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseRange);
  }
}

/**
 * The open, with what the surface needs back: the chain is asked for the stake once more before any
 * signature, and a figure above the confirmed one is surfaced as a requote instead of sent.
 */
export async function submitRangeOpen(ctx: RangeTxContext, intent: OpenIntent, onPhase?: PhaseListener): Promise<RangeOpenOutcome> {
  if (!ctx.contracts || !getRangeDeployment()) return { status: "refused", diagnosis: diagnosis("not-deployed", RANGE_NOT_DEPLOYED) };
  const band = { marketId: intent.marketId, asset: intent.asset, side: intent.side, lowPrint: intent.lowPrint, highPrint: intent.highPrint };
  const fresh = await previewRangeOpen(band, intent.maxPayoutBase);
  if (!fresh.ok) return { status: "refused", diagnosis: fresh.error };
  if (fresh.value.stakeBase > intent.maxStakeBase) return { status: "requote", stakeBase: fresh.value.stakeBase, maxPayoutBase: intent.maxPayoutBase };

  const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: summarizeRange(intent, getCollateral().decimals), marketId: intent.marketId });
  const gas = await checkGas(ctx.wallet, "range");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return { status: "refused", diagnosis: gas.diagnosis };
  }
  onPhase?.("submitted");
  try {
    const sent = await sendRangeIntent(ctx.contracts, intent);
    await ctx.journal.markSent(record.id, sent.hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: sent.hash });
    const booked = bookRangeOpen(sent);
    if (!booked) return { status: "unknown", diagnosis: diagnosis("unknown", "the open confirmed but emitted no RangeOpened event"), txHash: sent.hash };
    return { status: "confirmed", txHash: sent.hash, roundId: booked.roundId, stakeBase: booked.stakeBase };
  } catch (error) {
    const failure = await settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseRange);
    if (failure.status === "confirmed") return { status: "unknown", diagnosis: diagnosis("unknown", "a failed send reported success"), txHash: failure.txHash };
    return failure;
  }
}
