import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  findLedgerPda,
  getPublicSweepExpiredInstruction,
  getUserRedeemInstructionAsync,
} from "@agari/clients/agari-events";
import type { PhaseListener, TxIntent, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type Diagnosis, type MarketId } from "@agari/core/types";
import { getCreateAssociatedTokenIdempotentInstructionAsync } from "@solana-program/token";
import type { Address as KitAddress, Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { readMarket, readSeat, readSeries, readTokenBalance, readVenue, type LedgerSeat } from "../runtime/accounts";
import { MARKET_STATE } from "../runtime/mappers";
import { ENGINE_CODE, failureDiagnosis } from "./chain-failure";
import { SimulationFailedError } from "./errors";
import { eventAuthorityAddress } from "./events";
import { checkGas, TOKEN_ACCOUNT_RENT_LAMPORTS } from "./fees";
import { signSendConfirm, type WriteContext } from "./settle-write";
import { buildWrite, type BuiltWrite } from "./steps/message";

export type RedeemIntent = Extract<TxIntent, { kind: "redeem" }>;

/** `public_sweep_expired` budget prepended when the seat still has resting orders (first-call.md §3.2). */
const SWEEP_MAX = 32;

const refused = (diag: Diagnosis): TxOutcome => ({ status: "refused", diagnosis: diag });
const kit = (value: string) => value as KitAddress;

type RedeemPlan = { market: NonNullable<Awaited<ReturnType<typeof readMarket>>>; seat: LedgerSeat; mint: KitAddress; ata: KitAddress; createAta: boolean; label: string };

/**
 * A seat that is gone was paid already: by the settler's `redeem_for` after its claim grace (D-032) or an earlier
 * redeem of this wallet. The index (or the Ledger's history) names the signature, so the claim reads as done.
 */
async function alreadyPaid(ctx: WriteContext, marketId: MarketId): Promise<TxOutcome> {
  const [ledger] = await findLedgerPda({ market: kit(marketId) });
  const txHash = await ctx.evidence.redeemedBy(ctx.wallet, marketId, ledger as string as Address);
  return txHash ? { status: "confirmed", txHash } : refused(diagnosis("already-claimed", `no seat of ${ctx.wallet} remains on Window ${marketId}`));
}

async function redeemInstructions(ctx: WriteContext, plan: RedeemPlan): Promise<Instruction[]> {
  const { market, seat, mint, ata } = plan;
  const { data } = market;
  const eventAuthority = await eventAuthorityAddress();
  const out: Instruction[] = [];
  if (seat.openOrders > 0) {
    out.push(getPublicSweepExpiredInstruction({ series: data.series, market: market.address, book: data.book, ledger: data.ledger, eventAuthority, program: AGARI_EVENTS_PROGRAM_ADDRESS, max: SWEEP_MAX }));
  }
  if (plan.createAta) out.push(await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: ctx.signer.address, mint }));
  // A full redeem: partial is PROGRAM-only (6232), so every leg of one Window resolves to this one transaction.
  out.push(
    await getUserRedeemInstructionAsync({
      authority: ctx.signer, series: data.series, market: market.address, ledger: data.ledger, mvault: data.mvault, authorityToken: ata,
      collateralMint: mint, eventAuthority, program: AGARI_EVENTS_PROGRAM_ADDRESS, seatIdx: seat.index, outcome: null, lots: null,
    }),
  );
  return out;
}

/** What to send, from head-fresh chain reads; or the lane's answer already, when there is nothing to send. */
async function planRedeem(ctx: WriteContext, marketId: MarketId): Promise<{ plan: RedeemPlan } | { outcome: TxOutcome }> {
  const market = await readMarket(marketId);
  if (!market) return { outcome: await alreadyPaid(ctx, marketId) };
  if (market.data.state === MARKET_STATE.open) return { outcome: refused(diagnosis("not-settled", `Window ${marketId} has not settled yet`)) };
  const seatRead = await readSeat(market.data.ledger, ctx.wallet);
  if (!seatRead?.seat) return { outcome: await alreadyPaid(ctx, marketId) };
  const [venue, series] = await Promise.all([readVenue(), readSeries(market.data.series)]);
  const token = await readTokenBalance(ctx.wallet, venue.collateralMint);
  const label = `Claim on ${series.symbol ?? "a drive"} Window #${market.data.index}`;
  return { plan: { market, seat: seatRead.seat, mint: venue.collateralMint, ata: token.ata, createAta: token.amountBase === null, label } };
}

/**
 * `submitTx({ kind: "redeem" })` (first-call.md §3.2, D-033): one full `user_redeem` per Window, with a sweep when
 * orders still rest and an idempotent ATA create when the wallet has none; a seat already paid reconciles to the
 * crank's signature. `outcomeIdx`/`amountRaw` are informational.
 */
export async function submitRedeem(ctx: WriteContext, intent: RedeemIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  let planned: Awaited<ReturnType<typeof planRedeem>>;
  let built: BuiltWrite;
  try {
    planned = await planRedeem(ctx, intent.marketId);
    if ("outcome" in planned) return planned.outcome;
    const gas = await checkGas(ctx.rpc, ctx.wallet, "redeem", planned.plan.createAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0n);
    if (!gas.ok) return refused(gas.diagnosis);
    built = await buildWrite(ctx.rpc, ctx.signer, await redeemInstructions(ctx, planned.plan));
  } catch (error) {
    if (error instanceof SimulationFailedError) {
      // The settler's crank paid the seat between our read and the simulation.
      if (error.failure.engineCode === ENGINE_CODE.seatMismatch) return alreadyPaid(ctx, intent.marketId);
      return refused(failureDiagnosis(error.failure));
    }
    return refused(diagnose(error));
  }

  const record = await ctx.journal.record({ kind: "redeem", wallet: ctx.wallet, summary: planned.plan.label, marketId: intent.marketId });
  onPhase?.("submitted");
  const settled = await signSendConfirm(ctx, record.id, built, onPhase);
  if (settled.kind === "not-sent") {
    onPhase?.("composing");
    const { error } = settled;
    // The preflight is the first simulation of the signed bytes. The settler's crank (D-032) can pay the seat between
    // the build and the wallet's signature, and its SeatMismatch means "paid already", never a refusal of this wallet.
    if (error instanceof SimulationFailedError && error.failure.engineCode === ENGINE_CODE.seatMismatch) return alreadyPaid(ctx, intent.marketId);
    return refused(error instanceof SimulationFailedError ? failureDiagnosis(error.failure) : diagnose(error));
  }
  const txHash = settled.signature;
  if (settled.kind === "unknown") {
    onPhase?.("unknown");
    return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
  }
  if (settled.kind === "landed-failed") {
    const diag = failureDiagnosis(settled.failure);
    await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
    onPhase?.("reverted", { txHash });
    const kind = settled.failure.engineCode === ENGINE_CODE.seatMismatch ? "already-claimed" : diag.kind;
    return { status: "reverted", diagnosis: diagnosis(kind, diag.technical, { txHash }), txHash };
  }
  await ctx.journal.markConfirmed(record.id);
  onPhase?.("confirmed", { txHash });
  return { status: "confirmed", txHash };
}
