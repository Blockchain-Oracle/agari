import {
  fetchMaybeParlayReserve, fetchMaybeParlayTicket, getOwnerOpenParlayInstructionAsync, getProviderSupplyInstructionAsync,
  getProviderWithdrawInstructionAsync, getPublicClaimParlayInstructionAsync, getPublicResolveLegInstructionAsync,
} from "@agari/clients/agari-parlay";
import { phase } from "@agari/core/lifecycle";
import { PARLAY_STAKE_HEADROOM_BPS, type ParlayIntent } from "@agari/core/parlay";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import { diagnosis, type Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AccountRole, type Instruction } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { getMarket } from "../provider/markets";
import { readMarket } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { signSendConfirm, type WriteContext } from "../submitter/settle-write";
import { buildWrite } from "../submitter/steps/message";
import { kit, parlayProgramId, reserveAddress, ticketAddress } from "./deployment";
import type { ParlayOpenOutcome } from "./types";

const BPS = 10_000n;

async function reserveOrRefuse() {
  const reserve = await fetchMaybeParlayReserve(solana().rpc, kit(await reserveAddress()));
  if (!reserve.exists) throw new OrderRefusedError(diagnosis("not-deployed", "no parlay reserve on this cluster"));
  return reserve.data;
}

/**
 * Open one ticket against the reserve, through the same lane every other write uses.
 *
 * The chain prices every leg at its own slot, so what is sent is the payout the buyer asked for and a cap on the
 * stake, never a stake. `PARLAY_STAKE_HEADROOM_BPS` over the quoted stake is the whole tolerance: inside it the
 * buyer is charged the fresh price, and past it the program refuses with `StakeAboveMax` rather than overcharge.
 * Each leg's Market, Book and Series follow the named accounts, read-only, in leg order.
 */
export async function submitParlayOpenWrite(
  ctx: WriteContext,
  intent: Extract<ParlayIntent, { kind: "parlay-open" }>,
  onPhase?: PhaseListener,
): Promise<ParlayOpenOutcome> {
  try {
    const reserve = await reserveOrRefuse();
    const first = intent.legs[0];
    if (!first) throw new OrderRefusedError(diagnosis("below-min-quantity", "a ticket needs at least two legs"));
    const reading = await getMarket(first.marketId);
    if (!reading.ok || !reading.value) throw new OrderRefusedError(diagnosis("market-not-trading", "the first leg's Window is not readable"));
    const decimals = reading.value.decimals;

    const legAccounts = await Promise.all(intent.legs.map(async (leg) => {
      const market = await readMarket(leg.marketId);
      if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window not found: ${leg.marketId}`));
      const view = await getMarket(leg.marketId);
      if (view.ok && view.value && phase(view.value, ctx.nowMs()) !== "trading") {
        throw new OrderRefusedError(diagnosis("market-not-trading", `Window ${leg.marketId} is not open for calls`));
      }
      return [kit(leg.marketId), kit(market.data.book as unknown as string), kit(market.data.series as unknown as string)];
    }));

    const parlayId = reserve.nextParlayId;
    const [ownerToken] = await findAssociatedTokenPda({ owner: kit(ctx.wallet), mint: reserve.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const maxStakeBase = (intent.maxStakeBase * (BPS + BigInt(PARLAY_STAKE_HEADROOM_BPS))) / BPS;
    const open = await getOwnerOpenParlayInstructionAsync({
      owner: ctx.signer,
      ticket: kit(await ticketAddress(parlayId)),
      ownerToken,
      collateralMint: reserve.collateralMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      legsUp: intent.legs.map((leg) => leg.side === "up"),
      maxPayoutBase: intent.maxPayoutBase,
      maxStakeBase,
    }, { programAddress: kit(parlayProgramId()) });
    const instruction: Instruction = {
      ...open,
      accounts: [...(open.accounts ?? []), ...legAccounts.flat().map((address) => ({ address, role: AccountRole.READONLY }))],
    };
    const built = await buildWrite(ctx.rpc, ctx.signer, [instruction]);

    const summary = `${intent.legs.length}-leg ticket, up to ${formatBaseUnits(maxStakeBase, decimals)} staked for ${formatBaseUnits(intent.maxPayoutBase, decimals)}`;
    const record = await ctx.journal.record({ kind: "order", wallet: ctx.wallet, summary, marketId: first.marketId });
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
    // The chain priced at its own slot, so the stake actually charged is the ticket's, read back from the account.
    const ticket = await fetchMaybeParlayTicket(solana().rpc, kit(await ticketAddress(parlayId)));
    return { status: "confirmed", txHash, parlayId, stakeBase: ticket.exists ? ticket.data.stakeBase : intent.maxStakeBase };
  } catch (error) {
    onPhase?.("composing");
    return openRefusal(error);
  }
}

function openRefusal(error: unknown): ParlayOpenOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}

type LaneIntent = Exclude<ParlayIntent, { kind: "parlay-open" }>;

async function instructionFor(ctx: WriteContext, intent: LaneIntent): Promise<Instruction> {
  const config = { programAddress: kit(parlayProgramId()) };
  const reserve = await reserveOrRefuse();
  const shared = { collateralMint: reserve.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS };

  if (intent.kind === "parlay-supply" || intent.kind === "parlay-withdraw") {
    const [providerToken] = await findAssociatedTokenPda({ owner: kit(ctx.wallet), mint: reserve.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const accounts = { ...shared, provider: ctx.signer, providerToken };
    return intent.kind === "parlay-supply"
      ? getProviderSupplyInstructionAsync({ ...accounts, amountBase: intent.amountBase }, config)
      : getProviderWithdrawInstructionAsync({ ...accounts, shares: intent.shares }, config);
  }

  const address = kit(await ticketAddress(intent.parlayId));
  if (intent.kind === "parlay-resolve-leg") {
    return getPublicResolveLegInstructionAsync({ cranker: ctx.signer, ticket: address, market: kit(intent.marketId), legIdx: intent.legIdx }, config);
  }
  // A claim pays the ticket's owner whoever sends it, so the destination is the owner's account, not the sender's.
  const ticket = await fetchMaybeParlayTicket(solana().rpc, address);
  if (!ticket.exists) throw new OrderRefusedError(diagnosis("not-settled", `no ticket ${intent.parlayId}`));
  const [ownerToken] = await findAssociatedTokenPda({ owner: ticket.data.owner, mint: reserve.collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return getPublicClaimParlayInstructionAsync({ ...shared, cranker: ctx.signer, ticket: address, ownerToken }, config);
}

/** Every parlay write but the open: settle a leg, claim, supply and withdraw, through the session's queued lane. */
export async function submitParlayTx(ctx: WriteContext, intent: LaneIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  try {
    const instruction = await instructionFor(ctx, intent);
    const built = await buildWrite(ctx.rpc, ctx.signer, [instruction]);
    const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: intent.kind });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") return laneRefusal(settled.error);
    const txHash = settled.signature as Signature;
    if (settled.kind === "unknown") {
      return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason})`, { txHash }), txHash };
    }
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash });
    return { status: "confirmed", txHash };
  } catch (error) {
    return laneRefusal(error);
  }
}

function laneRefusal(error: unknown): TxOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}
