/**
 * `submitTx({ kind: "cancel-orders" })` (D-088): `user_cancel_orders` on the wallet's own resting calls on one Window,
 * from head-fresh reads of the Market and the wallet's seat. The engine refunds each order's escrow to the seat's credit
 * (`refund_escrow`); with `withdraw` the same instruction pays that credit out to the wallet's token account. Any status.
 */
import { AGARI_EVENTS_PROGRAM_ADDRESS, getUserCancelOrdersInstructionAsync } from "@agari/clients/agari-events";
import type { PhaseListener, TxIntent, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import type { Address as KitAddress, Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { readMarket, readSeat, readTokenBalance, readVenue, type LedgerSeat } from "../runtime/accounts";
import { failureDiagnosis } from "./chain-failure";
import { SimulationFailedError } from "./errors";
import { eventAuthorityAddress } from "./events";
import { checkGas } from "./fees";
import { signSendConfirm, type WriteContext } from "./settle-write";
import { buildWrite, type BuiltWrite } from "./steps/message";

export type CancelIntent = Extract<TxIntent, { kind: "cancel-orders" }>;

/** `user_cancel_orders` takes at most this many handles (events-instructions.md §3.2). */
const MAX_HANDLES = 16;

const refused = (diag: Diagnosis): TxOutcome => ({ status: "refused", diagnosis: diag });
const kit = (value: string) => value as KitAddress;

type CancelPlan = { market: NonNullable<Awaited<ReturnType<typeof readMarket>>>; seat: LedgerSeat; mint: KitAddress; ata: KitAddress; label: string };

async function cancelInstruction(ctx: WriteContext, intent: CancelIntent, plan: CancelPlan): Promise<Instruction> {
  const { data } = plan.market;
  return getUserCancelOrdersInstructionAsync({
    authority: ctx.signer,
    series: data.series,
    market: plan.market.address,
    book: data.book,
    ledger: data.ledger,
    // The four token accounts ride only with a withdraw (the engine refuses a withdraw without them).
    ...(intent.withdraw ? { mvault: data.mvault, authorityToken: plan.ata, collateralMint: plan.mint } : {}),
    eventAuthority: await eventAuthorityAddress(),
    program: AGARI_EVENTS_PROGRAM_ADDRESS,
    handles: intent.handles.map(({ node, seq }) => ({ node, seq })),
    seatIdx: plan.seat.index,
    withdraw: intent.withdraw,
  });
}

async function planCancel(ctx: WriteContext, intent: CancelIntent): Promise<{ plan: CancelPlan } | { outcome: TxOutcome }> {
  if (intent.handles.length === 0 || intent.handles.length > MAX_HANDLES) return { outcome: refused(diagnosis("invalid-price", `a cancel names 1..${MAX_HANDLES} orders, not ${intent.handles.length}`)) };
  const market = await readMarket(intent.marketId);
  if (!market) return { outcome: refused(diagnosis("contract-revert", `Window ${intent.marketId} is gone: nothing rests there`)) };
  const seatRead = await readSeat(market.data.ledger, ctx.wallet);
  if (!seatRead?.seat) return { outcome: refused(diagnosis("contract-revert", `${ctx.wallet} holds no seat on Window ${intent.marketId}: nothing rests`)) };
  const venue = await readVenue();
  const token = await readTokenBalance(ctx.wallet, venue.collateralMint);
  const label = `Cancel ${intent.handles.length} resting ${intent.handles.length === 1 ? "call" : "calls"} on Window #${market.data.index}${intent.withdraw ? ", escrow back to the wallet" : ""}`;
  return { plan: { market, seat: seatRead.seat, mint: kit(venue.collateralMint), ata: token.ata, label } };
}

export async function submitCancel(ctx: WriteContext, intent: CancelIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  let planned: Awaited<ReturnType<typeof planCancel>>;
  let built: BuiltWrite;
  try {
    planned = await planCancel(ctx, intent);
    if ("outcome" in planned) return planned.outcome;
    const gas = await checkGas(ctx.rpc, ctx.wallet, "order");
    if (!gas.ok) return refused(gas.diagnosis);
    built = await buildWrite(ctx.rpc, ctx.signer, [await cancelInstruction(ctx, intent, planned.plan)]);
  } catch (error) {
    return refused(error instanceof SimulationFailedError ? failureDiagnosis(error.failure) : diagnose(error));
  }

  const record = await ctx.journal.record({ kind: "cancel-orders", wallet: ctx.wallet, summary: planned.plan.label, marketId: intent.marketId });
  onPhase?.("submitted");
  const settled = await signSendConfirm(ctx, record.id, built, onPhase);
  if (settled.kind === "not-sent") {
    onPhase?.("composing");
    const { error } = settled;
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
    return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
  }
  await ctx.journal.markConfirmed(record.id);
  onPhase?.("confirmed", { txHash });
  return { status: "confirmed", txHash };
}
