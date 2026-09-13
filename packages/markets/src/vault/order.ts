import type { BookedOrder, OrderOutcome, OrderRequest, OrderRoute, PhaseListener } from "@masayume/core/ports";
import { diagnosis, type Diagnosis, type Hex, type MarketId, type Quote, type Side } from "@masayume/core/types";
import { simulateCaps, VAULT_NOT_DEPLOYED, type CapRefusal, type VaultGrant } from "@masayume/core/vault";
import { formatBaseUnits, msToSec, oneUnit, ownTermsPriceRaw, priceRawToBps } from "@masayume/core/units";
import { formatCadence } from "@masayume/core/copy";
import { parseEventLogs } from "viem";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { outcomeIdxOf } from "../mappers/side";
import { OrderRefusedError, RequoteError } from "../submitter/errors";
import type { OrderLaneContext } from "../submitter/order-lane";
import { diagnoseWrite } from "../submitter/steps/assert-tx-ok";
import { orderExpiryNs } from "../submitter/steps/expiry";
import { freshQuote } from "../submitter/steps/quote";
import { statusGate } from "../submitter/steps/status-gate";
import { getVaultHoldings, getVaultSnapshot, toVaultGrant } from "./read";
import { checkVaultGas, settleVaultFailure, writeVault, type Sent, type VaultContracts } from "./write";

type VaultRoute = Exclude<OrderRoute, { kind: "wallet" }>;

function refused(diag: Diagnosis): OrderOutcome {
  return { status: "refused", diagnosis: diag };
}

function capRefusalText(refusal: CapRefusal, decimals: number): string {
  const money = (base: bigint) => formatBaseUnits(base, decimals);
  switch (refusal.kind) {
    case "revoked":
      return "the grant has been revoked";
    case "expired":
      return `the grant expired at ${new Date(refusal.expiresAtSec * 1000).toISOString()}`;
    case "price":
      return `the side is priced ${refusal.sidePriceRaw} against a cap of ${refusal.capRaw}`;
    case "escrow":
      return `the order escrows ${money(refusal.worstBase)} but the grant's budget is ${money(refusal.budgetBase)}`;
    case "stake":
      return `the order would spend ${money(refusal.spendBase)} against a per-trade cap of ${money(refusal.capBase)}`;
    case "daily":
      return `today's spend would reach ${money(refusal.wouldBeBase)} against a daily cap of ${money(refusal.capBase)} (resets 00:00 UTC)`;
    case "positions":
      return `this would be open position ${refusal.wouldBe} of ${refusal.cap}`;
    default: {
      const exhaustive: never = refusal;
      return String(exhaustive);
    }
  }
}

async function readGrant(contracts: VaultContracts, grantId: bigint): Promise<VaultGrant> {
  const deployment = contracts.deployment;
  if (!deployment) throw new OrderRefusedError(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
  const tuple = await contracts.publicClient.readContract({ address: deployment.eventVault, abi: eventVaultAbi, functionName: "grantOf", args: [grantId] });
  return toVaultGrant(grantId, tuple);
}

/** The vault's own pre-checks, mirroring the contract so a refusal happens before any signature. */
async function assertVaultFunded(contracts: VaultContracts, route: VaultRoute, req: OrderRequest, quote: Quote, nowMs: number): Promise<void> {
  const { market, side } = req;
  if (route.kind === "vault") {
    const snapshot = await getVaultSnapshot(req.wallet);
    if (!snapshot.ok) throw new OrderRefusedError(snapshot.error);
    const available = snapshot.value?.account.availableBase ?? 0n;
    if (available < quote.maxCostBase) {
      throw new OrderRefusedError(
        diagnosis("insufficient-collateral", `the Trading Balance holds ${formatBaseUnits(available, market.decimals)} but the order escrows ${formatBaseUnits(quote.maxCostBase, market.decimals)}`),
      );
    }
    return;
  }
  const grant = await readGrant(contracts, route.grantId);
  const onchain = await statusGate(market.marketId);
  const holdings = await getVaultHoldings(grant.owner, onchain);
  const heldRaw = holdings.ok ? (side === "up" ? holdings.value.upRaw : holdings.value.downRaw) : 0n;
  const verdict = simulateCaps({
    grant,
    nowSec: msToSec(nowMs),
    sidePriceRaw: ownTermsPriceRaw(quote.limitPriceRaw, side, market.decimals),
    quantityRaw: quote.contractsRaw,
    spendBase: quote.expectedCostBase,
    one: oneUnit(market.decimals),
    opensNewPosition: heldRaw === 0n,
  });
  if (!verdict.ok) {
    const names: Record<CapRefusal["kind"], string> = { revoked: "GrantIsRevoked", expired: "GrantExpired", price: "OverPriceCap", escrow: "Insufficient", stake: "OverStakeCap", daily: "OverDailyCap", positions: "OverPositionCap" };
    throw new OrderRefusedError(diagnosis("grant-refused", capRefusalText(verdict.refusal, market.decimals), { errorName: names[verdict.refusal.kind] }));
  }
}

/** What the vault booked is what its `Executed` event says — collateral moved and tokens gained (FR-9). */
export function bookVaultFill(sent: Sent, marketId: MarketId, side: Side, decimals: number): BookedOrder | null {
  const logs = parseEventLogs({ abi: eventVaultAbi, eventName: "Executed", logs: sent.receipt.logs });
  const fill = logs.find((log) => log.args.marketId.toLowerCase() === marketId);
  if (!fill || fill.args.tokenDelta === 0n) return null;
  const one = oneUnit(decimals);
  return {
    marketId,
    side,
    contractsRaw: fill.args.tokenDelta,
    costBase: fill.args.cashDelta,
    avgPriceBps: priceRawToBps((fill.args.cashDelta * one) / fill.args.tokenDelta, decimals),
    txHash: sent.hash,
    fillCount: 1,
  };
}

function summarize({ side, market, stakeBase, route }: OrderRequest): string {
  const via = route?.kind === "vault-grant" ? `grant #${route.grantId}` : "the Trading Balance";
  return `${side === "up" ? "Up" : "Down"} on ${market.asset} (${formatCadence(market.intervalSec)} Window), ${formatBaseUnits(stakeBase, market.decimals)} staked via ${via}`;
}

/**
 * The order lane's vault route (AD-3's third dimension): the same gates, quote, expiry and journal
 * as a wallet order, then one call into the EventVault, booked from its own event rather than the
 * venue's fills. Delegated orders are pre-checked against the grant exactly as the contract will.
 */
export async function submitVaultOrder(ctx: OrderLaneContext & { contracts: VaultContracts | undefined }, req: OrderRequest, onPhase?: PhaseListener): Promise<OrderOutcome> {
  const route = req.route as VaultRoute;
  const { contracts, wallet } = ctx;
  if (!contracts?.deployment) return refused(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
  const { market, side, stakeBase, displayedQuote } = req;
  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };

  let reservationId: string | null = null;
  try {
    const onchain = await statusGate(market.marketId);
    const stop = await ctx.stopGate.checkAndReserve(wallet, displayedQuote.maxCostBase);
    if (!stop.ok) return refused(diagnosis("daily-stop", stop.reason));
    reservationId = stop.reservationId;

    const quote = await freshQuote({ target, side, stakeBase, displayed: displayedQuote });
    const expireNs = orderExpiryNs(ctx.nowMs(), onchain, market.intervalSec);
    await assertVaultFunded(contracts, route, req, quote, ctx.nowMs());
    const gas = await checkVaultGas(contracts, wallet, "vault-order", route.kind === "vault" ? "place" : "placeFor");
    if (!gas.ok) throw new OrderRefusedError(gas.diagnosis);

    const record = await ctx.journal.record({ kind: "order", wallet, summary: summarize(req), pool: market.poolAddress, marketId: market.marketId });
    onPhase?.("submitted");
    let broadcastHash: Hex | undefined;
    try {
      const onBroadcast = async (hash: Hex) => {
        broadcastHash = hash;
        await ctx.journal.markSent(record.id, hash);
      };
      const outcomeIdx = outcomeIdxOf(side);
      const args = [market.marketId, outcomeIdx, true, quote.limitPriceRaw, quote.contractsRaw, expireNs] as const;
      const sent =
        route.kind === "vault"
          ? await writeVault(contracts, "place", args, "order", onBroadcast)
          : await writeVault(contracts, "placeFor", [route.grantId, ...args], "order", onBroadcast);
      const booked = bookVaultFill(sent, market.marketId, side, market.decimals);
      await ctx.journal.markConfirmed(record.id);
      await ctx.stopGate.reconcile(reservationId, booked?.costBase ?? 0n);
      reservationId = null;
      onPhase?.("confirmed", { txHash: sent.hash });
      return booked ? { status: "confirmed", booked } : { status: "nothingFilled", txHash: sent.hash };
    } catch (error) {
      const failure = await settleVaultFailure(ctx.journal, record.id, error, onPhase, undefined, broadcastHash);
      if (failure.status === "unknown") {
        // An unknown send may still land, so its reservation stays until the journal is reconciled (AD-9).
        reservationId = null;
        return { status: "unknown", diagnosis: failure.diagnosis, ...(failure.txHash ? { txHash: failure.txHash } : {}) };
      }
      if (failure.status === "reverted" && failure.txHash) return { status: "reverted", diagnosis: failure.diagnosis, txHash: failure.txHash };
      return refused(failure.status === "confirmed" ? diagnosis("unknown", "a failed send reported success") : failure.diagnosis);
    }
  } catch (error) {
    onPhase?.("composing");
    if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
    if (error instanceof OrderRefusedError) return refused(error.diagnosis);
    return refused(diagnoseWrite(error));
  } finally {
    if (reservationId) await ctx.stopGate.reconcile(reservationId, 0n);
  }
}
