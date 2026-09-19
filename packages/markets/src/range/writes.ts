import { fetchMaybeReserve, getOwnerOpenRoundInstructionAsync } from "@agari/clients/agari-range";
import { phase } from "@agari/core/lifecycle";
import type { PhaseListener } from "@agari/core/ports";
import { diagnosis, type Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { RANGE_STAKE_HEADROOM_BPS, type RangeIntent } from "@agari/core/range";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { diagnose } from "../errors/error-map";
import { getMarket } from "../provider/markets";
import { failureDiagnosis } from "../submitter/chain-failure";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { signSendConfirm, type WriteContext } from "../submitter/settle-write";
import { buildWrite } from "../submitter/steps/message";
import type { RangeOpenOutcome } from "./read";
import { expiryBookAddress, kit, reserveAddress, roundAddress } from "./deployment";
import { solana } from "../runtime/solana";

const BPS = 10_000n;

/**
 * Open one round against the reserve, through the same lane every other write uses.
 *
 * The chain re-prices at its own clock, so what is sent is the payout the buyer asked for and a cap on the stake —
 * never a stake. `RANGE_STAKE_HEADROOM_BPS` over the quoted stake is the whole tolerance: inside it the buyer is
 * charged the fresh price, and past it the program refuses with `StakeAboveMax` rather than overcharging them.
 */
export async function submitRangeOpenWrite(
  ctx: WriteContext,
  intent: Extract<RangeIntent, { kind: "range-open" }>,
  onPhase?: PhaseListener,
): Promise<RangeOpenOutcome> {
  try {
    const reading = await getMarket(intent.marketId);
    if (!reading.ok || !reading.value) throw new OrderRefusedError(diagnosis("market-not-trading", `Window ${intent.marketId} is not readable`));
    const market = reading.value;
    if (phase(market, ctx.nowMs()) !== "trading") {
      throw new OrderRefusedError(diagnosis("market-not-trading", `Window ${intent.marketId} is not open for calls`));
    }

    const reserve = await fetchMaybeReserve(solana().rpc, kit(await reserveAddress()));
    if (!reserve.exists) throw new OrderRefusedError(diagnosis("not-deployed", "no range reserve on this cluster"));
    const roundId = reserve.data.nextRoundId;

    const [ownerToken] = await findAssociatedTokenPda({
      owner: kit(ctx.wallet), mint: kit(market.collateral), tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const maxStakeBase = (intent.maxStakeBase * (BPS + BigInt(RANGE_STAKE_HEADROOM_BPS))) / BPS;
    const instruction = await getOwnerOpenRoundInstructionAsync({
      owner: ctx.signer,
      round: kit(await roundAddress(roundId)),
      expiryBook: kit(await expiryBookAddress(market.expirySec)),
      ownerToken,
      collateralMint: kit(market.collateral),
      market: kit(intent.marketId),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      isInside: intent.side === "inside",
      lowPrint: intent.lowPrint,
      highPrint: intent.highPrint,
      maxPayoutBase: intent.maxPayoutBase,
      maxStakeBase,
      expirySec: market.expirySec,
    });
    const built = await buildWrite(ctx.rpc, ctx.signer, [instruction]);

    const summary = `${intent.side === "inside" ? "Inside" : "Outside"} ${intent.asset} [${intent.lowPrint}, ${intent.highPrint}], `
      + `up to ${formatBaseUnits(maxStakeBase, market.decimals)} staked for ${formatBaseUnits(intent.maxPayoutBase, market.decimals)}`;
    const record = await ctx.journal.record({ kind: "order", wallet: ctx.wallet, summary, pool: market.poolAddress, marketId: intent.marketId });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);

    if (settled.kind === "not-sent") {
      onPhase?.("composing");
      return outcomeOf(settled.error);
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
    // `stakeBase` is the cap the buyer agreed to, not a claim about what was charged: the chain priced at its own
    // clock and the Round account holds the figure. The slip reads it back rather than trusting this.
    return { status: "confirmed", txHash, roundId, stakeBase: intent.maxStakeBase };
  } catch (error) {
    onPhase?.("composing");
    return outcomeOf(error);
  }
}

function outcomeOf(error: unknown): RangeOpenOutcome {
  if (error instanceof OrderRefusedError) return { status: "refused", diagnosis: error.diagnosis };
  if (error instanceof SimulationFailedError) return { status: "refused", diagnosis: failureDiagnosis(error.failure) };
  return { status: "refused", diagnosis: diagnose(error) };
}
