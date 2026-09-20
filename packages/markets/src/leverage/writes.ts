import {
  getOwnerCloseInstructionAsync, getOwnerOpenInstructionAsync, getProviderSupplyInstructionAsync, getProviderWithdrawInstructionAsync,
  getPublicClaimInstructionAsync, getPublicKnockOutInstructionAsync, getPublicSettleInstructionAsync,
} from "@agari/clients/agari-leverage";
import type { LeverageIntent } from "@agari/core/leverage";
import { phase } from "@agari/core/lifecycle";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type MarketId, type Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { getMarket } from "../provider/markets";
import { readMarket, readSeries } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { submitLaneWrite } from "../submitter/lane-write";
import { signSendConfirm, type WriteContext } from "../submitter/settle-write";
import { buildWrite } from "../submitter/steps/message";
import { kit, leverageProgramId, positionAddress, providerAddress, windowBookAddress } from "./deployment";
import { sizeLeverageForStake } from "./quote";
import { readPosition, readReserve } from "./reads";
import type { LeverageOpenOutcome } from "./types";

const config = () => ({ programAddress: kit(leverageProgramId()) });

async function reserveOrRefuse() {
  const reserve = await readReserve();
  if (!reserve) throw new OrderRefusedError(diagnosis("not-deployed", "no leverage reserve on this cluster"));
  return reserve;
}

/** One Window's engine accounts, read from the Market itself rather than trusted from a caller. */
async function engineOf(marketId: MarketId) {
  const market = await readMarket(marketId);
  if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  const { data } = market;
  return { series: kit(data.series as unknown as string), market: kit(marketId), book: kit(data.book as unknown as string), ledger: kit(data.ledger as unknown as string), mvault: kit(data.mvault as unknown as string) };
}

const tokenAccountOf = async (owner: Address, mint: string) => (await findAssociatedTokenPda({ owner: kit(owner), mint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];

async function exists(address: string): Promise<boolean> {
  return (await solana().rpc.getAccountInfo(kit(address), { encoding: "base64" }).send()).value !== null;
}

/**
 * Open one boost, through the same lane every other write uses.
 *
 * The chain sizes the boost from the stake at its own slot, so what is sent is the stake, the multiple and the
 * fewest contracts the owner will accept. Inside that guard the owner gets the fresh book's size and any unspent
 * stake straight back; under it the program refuses with `BelowMinQuantity` rather than fill worse.
 */
export async function submitLeverageOpenWrite(
  ctx: WriteContext,
  intent: Extract<LeverageIntent, { kind: "leverage-open" }>,
  onPhase?: PhaseListener,
): Promise<LeverageOpenOutcome> {
  try {
    const reserve = await reserveOrRefuse();
    const view = await getMarket(intent.marketId);
    if (!view.ok || !view.value) throw new OrderRefusedError(diagnosis("market-not-trading", "the Window is not readable"));
    if (phase(view.value, ctx.nowMs()) !== "trading") throw new OrderRefusedError(diagnosis("market-not-trading", `Window ${intent.marketId} is not open for calls`));
    const { decimals } = view.value;
    // Asked again at send time: a book that moved past the owner's guard comes back as a requote, never a popup.
    const fresh = await sizeLeverageForStake(intent.marketId, intent.side, intent.stakeBase, intent.leverageBps);
    if (!fresh.ok) throw new OrderRefusedError(fresh.error);
    if (fresh.value.quantityRaw < intent.minQuantityRaw) return { status: "requote", stakeBase: fresh.value.stakeBase, quantityRaw: fresh.value.quantityRaw };

    const engine = await engineOf(intent.marketId);
    const { lotBase } = await readSeries(engine.series);

    const positionId = reserve.data.nextPositionId;
    const open = await getOwnerOpenInstructionAsync({
      owner: ctx.signer,
      position: kit(await positionAddress(positionId)),
      window: kit(await windowBookAddress(intent.marketId)),
      ownerToken: await tokenAccountOf(ctx.wallet, reserve.data.collateralMint),
      ...engine,
      collateralMint: reserve.data.collateralMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      outcome: intent.side === "up" ? 0 : 1,
      stakeBase: intent.stakeBase,
      leverageBps: intent.leverageBps,
      minLots: intent.minQuantityRaw / lotBase,
    }, config());
    const built = await buildWrite(ctx.rpc, ctx.signer, [open]);

    const summary = `${intent.leverageBps / 10_000}x ${intent.side} with ${formatBaseUnits(intent.stakeBase, decimals)} staked`;
    const record = await ctx.journal.record({ kind: "order", wallet: ctx.wallet, summary, marketId: intent.marketId });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);

    if (settled.kind === "not-sent") {
      onPhase?.("composing");
      return openRefusal(settled.error);
    }
    const txHash = settled.signature as Signature;
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
    // The chain sized and charged at its own slot, so the figures are the position's, read back from the account.
    const position = await readPosition(positionId);
    return {
      status: "confirmed",
      txHash,
      positionId,
      stakeBase: position ? position.stakeBase : intent.stakeBase,
      quantityRaw: position ? position.lots * position.lotBase : intent.minQuantityRaw,
      frontedBase: position ? position.frontedBase : 0n,
    };
  } catch (error) {
    onPhase?.("composing");
    return openRefusal(error);
  }
}

function openRefusal(error: unknown): LeverageOpenOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}

type LaneIntent = Exclude<LeverageIntent, { kind: "leverage-open" }>;

async function instructionsFor(ctx: WriteContext, intent: LaneIntent): Promise<Instruction[]> {
  const reserve = await reserveOrRefuse();
  const mint = reserve.data.collateralMint;
  const shared = { collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS };

  if (intent.kind === "leverage-supply" || intent.kind === "leverage-withdraw") {
    const accounts = { ...shared, provider: ctx.signer, position: kit(await providerAddress(ctx.wallet)), providerToken: await tokenAccountOf(ctx.wallet, mint) };
    return [intent.kind === "leverage-supply"
      ? await getProviderSupplyInstructionAsync({ ...accounts, amountBase: intent.amountBase }, config())
      : await getProviderWithdrawInstructionAsync({ ...accounts, shares: intent.shares }, config())];
  }

  const raw = await readPosition(intent.positionId);
  if (!raw) throw new OrderRefusedError(diagnosis("not-settled", `no position ${intent.positionId}`));
  const owner = raw.owner as string as Address;
  const ownerToken = await tokenAccountOf(owner, mint);
  const position = kit(await positionAddress(intent.positionId));

  if (intent.kind === "leverage-claim") {
    // The destination has to exist to be paid; whoever sends the claim pays to create it, and it is still the owner's.
    const create = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: kit(owner), mint: kit(mint) });
    return [create, await getPublicClaimInstructionAsync({ ...shared, caller: ctx.signer, position, ownerToken }, config())];
  }

  const marketId = raw.market as string as MarketId;
  const engine = await engineOf(marketId);
  const window = kit(await windowBookAddress(marketId));

  if (intent.kind === "leverage-close") {
    // The owner is the sender here, so their account is made sure of and they are paid in this transaction.
    const create = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.signer, owner: kit(owner), mint: kit(mint) });
    return [create, await getOwnerCloseInstructionAsync({ ...shared, ...engine, caller: ctx.signer, position, window, ownerToken, minProceedsBase: intent.minProceedsBase }, config())];
  }

  // Permissionless exits never wait on the owner: with no token account to pay, the money is left owed (D-114).
  const payable = (await exists(ownerToken)) ? { ownerToken } : {};
  if (intent.kind === "leverage-knock-out") {
    return [await getPublicKnockOutInstructionAsync({ ...shared, ...engine, caller: ctx.signer, position, window, ...payable }, config())];
  }
  const { book: _book, ...settleEngine } = engine;
  return [await getPublicSettleInstructionAsync({ ...shared, ...settleEngine, caller: ctx.signer, position, window, ...payable }, config())];
}

/** Every reserve write but the open: cash out, knock out, settle, claim, supply and withdraw, through the session's queued lane. */
export function submitLeverageTx(ctx: WriteContext, intent: LaneIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return submitLaneWrite(ctx, intent.kind, () => instructionsFor(ctx, intent), onPhase);
}
