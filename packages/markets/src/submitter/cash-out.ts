/**
 * The plain cash-out lane (L-35, tap-trading.md §1.4, D-067): sell a held side back into the Book with an IOC before
 * lock, on the wallet route (`user_place_order` SELL_*), the Trading Balance (`owner_place`, is_buy false) or a grant
 * (`actor_place_for`, sponsorable). The confirmed exit's `minProceedsBase` is the floor: a fresh exit below it is a
 * requote, never sent. Simulation 6110 re-quotes once; a landed 6110 filled nothing.
 */
import type { CashOutOutcome, CashOutRequest, OrderRoute, PhaseListener } from "@agari/core/ports";
import { SIDE_TO_OUTCOME, diagnosis, type Address, type Diagnosis, type ExitQuote, type Signature } from "@agari/core/types";
import { formatCadence } from "@agari/core/copy";
import { formatBaseUnits } from "@agari/core/units";
import { VAULT_NOT_DEPLOYED } from "@agari/core/vault";
import type { Address as KitAddress, Instruction } from "@solana/kit";
import { EXIT_LOCKED, exitQuoteFromBook, NO_EXIT_LIQUIDITY } from "../provider/exit-quote";
import { readBook, readMarket, readSeat, type SeriesFacts } from "../runtime/accounts";
import { forgetVaultAccount, readVaultAccount, sideOf, slotOf } from "../vault/accounts";
import { buildPaid, sendPaid, type PaidWrite } from "../vault/cosign";
import { loadVaultDeployment } from "../vault/deployment";
import { decodeVaultEvents } from "../vault/events";
import { engineBlockOf, lotsOf, placeIx, ticksOf } from "../vault/instructions";
import { bookVaultEvents, landOrder, notSentVaultDiagnosis, placeRouteOf, vaultOwnerOf, type VaultRoute } from "../vault/order";
import { vaultSeatOn } from "../vault/window";
import { ENGINE_CODE } from "./chain-failure";
import { decodeWriteEvents } from "./events";
import { OrderRefusedError, SimulationFailedError } from "./errors";
import { checkGas } from "./fees";
import type { OrderLaneContext } from "./order-lane";
import { orderExpiry } from "./steps/expiry";
import { buildWrite } from "./steps/message";
import { bookSellFromEvents, sellInstruction } from "./steps/sell";
import { statusGate } from "./steps/status-gate";

const refused = (diag: Diagnosis): CashOutOutcome => ({ status: "refused", diagnosis: diag });

class ExitRequote extends Error {
  constructor(readonly exit: ExitQuote) {
    super("the fresh exit pays less than the confirmed floor");
  }
}

interface PreparedSell {
  paid: PaidWrite;
  series: SeriesFacts;
  /** Whose seat or Trading Balance sells, and the grant that signs for it (0 when attended or on the wallet route). */
  owner: Address;
  grantId: bigint;
  /** Re-reads the Book after a simulation 6110: a requote, or no exit liquidity. */
  requote: () => Promise<never>;
}

function summarize(req: CashOutRequest, route: OrderRoute): string {
  const via = route.kind === "wallet" ? "" : route.kind === "vault" ? " from the Trading Balance" : ` via grant #${route.grantId}`;
  const size = formatBaseUnits(req.contractsRaw, req.market.decimals);
  return `Cash out ${size} ${req.side === "up" ? "Up" : "Down"} on ${req.market.asset} (${formatCadence(req.market.intervalSec)} Window)${via}`;
}

/** Status first: a Window that stopped trading has no exit, it pays at settlement (`00-plan.md:1001`). */
async function gateOf(req: CashOutRequest, nowMs: number) {
  try {
    return await statusGate(req.market, nowMs);
  } catch (error) {
    if (error instanceof OrderRefusedError && error.diagnosis.kind === "market-not-trading") throw new OrderRefusedError(diagnosis("market-not-trading", `${EXIT_LOCKED} (${error.diagnosis.technical})`));
    throw error;
  }
}

async function freshExit(req: CashOutRequest, series: SeriesFacts, heldLots: bigint, nowMs: number): Promise<ExitQuote> {
  const book = await readBook(req.market.poolAddress);
  const want = req.contractsRaw / series.lotBase < heldLots ? req.contractsRaw / series.lotBase : heldLots;
  const exit = book && book.market === (req.market.marketId as string) ? exitQuoteFromBook(book, series, req.side, want, Math.floor(nowMs / 1000)) : null;
  if (!exit) throw new OrderRefusedError(diagnosis("no-liquidity", NO_EXIT_LIQUIDITY));
  return exit;
}

async function prepareSell(ctx: OrderLaneContext, req: CashOutRequest, route: OrderRoute): Promise<PreparedSell> {
  const nowMs = ctx.nowMs();
  const gate = await gateOf(req, nowMs);
  const { series } = gate;
  const outcome = SIDE_TO_OUTCOME[req.side];
  let held: bigint;
  let owner = ctx.wallet;
  let grantId = 0n;
  let seatIndex = -1;
  let vault: { seat: Address; collateral: Address } | null = null;
  if (route.kind === "wallet") {
    const seat = (await readSeat(gate.onchain.ledger, ctx.wallet))?.seat ?? null;
    held = seat ? (outcome === 0 ? seat.yesFree : seat.noFree) : 0n;
    seatIndex = seat?.index ?? -1;
  } else {
    const deployment = await loadVaultDeployment();
    if (!deployment) throw new OrderRefusedError(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
    const resolved = await vaultOwnerOf(ctx, route);
    owner = resolved.owner;
    if (resolved.grant && resolved.grant.actor !== (ctx.wallet as string)) {
      throw new OrderRefusedError(diagnosis("grant-refused", `${ctx.wallet} is not grant #${resolved.grant.grantId}'s actor`, { errorName: "NotGrantActor" }));
    }
    grantId = route.kind === "vault-grant" ? route.grantId : 0n;
    forgetVaultAccount(owner);
    held = sideOf(slotOf(await readVaultAccount(owner), req.market.marketId), outcome).lots;
    vault = { seat: deployment.seat, collateral: deployment.collateral };
  }
  if (held === 0n) throw new OrderRefusedError(diagnosis("contract-revert", `nothing held on the ${req.side} side to cash out`, { errorName: "Insufficient" }));

  const exit = await freshExit(req, series, held, nowMs);
  if (exit.minProceedsBase < req.displayedExit.minProceedsBase) throw new ExitRequote(exit);
  const expireTs = orderExpiry(nowMs, { lockAtSec: gate.onchain.lockAtSec, intervalSec: req.market.intervalSec });
  const requote = async (): Promise<never> => {
    throw new ExitRequote(await freshExit(req, series, held, ctx.nowMs()));
  };

  let instructions: Instruction[];
  if (vault) {
    const seat = await vaultSeatOn(vault.seat, gate.onchain.ledger);
    if (!seat.ok) throw new OrderRefusedError(seat.diagnosis);
    const market = await readMarket(req.market.marketId);
    if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", EXIT_LOCKED));
    const order = { outcome, isBuy: false, priceTicks: ticksOf(exit.limitPriceRaw, series.tickBase), lots: lotsOf(exit.contractsRaw, series.lotBase), expireTs };
    instructions = [await placeIx(placeRouteOf(ctx, route as VaultRoute, owner), engineBlockOf(market, vault.collateral as string as KitAddress), order)];
  } else {
    instructions = [await sellInstruction({ signer: ctx.signer, market: req.market, ledger: gate.onchain.ledger, series, side: req.side, exit, expireTs, seatIndex })];
  }
  const paid = vault ? await buildPaid(ctx, instructions, route.kind === "vault-grant") : { built: await buildWrite(ctx.rpc, ctx.signer, instructions), sponsor: null, instructions };
  if (!paid.sponsor) {
    const gas = await checkGas(ctx.rpc, ctx.wallet, vault ? "vault-order" : "order");
    if (!gas.ok) throw new OrderRefusedError(gas.diagnosis);
  }
  return { paid, series, owner, grantId, requote };
}

async function notSent(error: unknown, prepared: PreparedSell | null): Promise<CashOutOutcome> {
  try {
    if (prepared && error instanceof SimulationFailedError && error.failure.engineCode === ENGINE_CODE.iocNoFill) await prepared.requote();
  } catch (requoted) {
    error = requoted;
  }
  if (error instanceof ExitRequote) return { status: "requote", exit: error.exit };
  return refused(notSentVaultDiagnosis(error));
}

/** `submitCashOut`: nothing is journaled until the exit, the seat or slot, and the simulation all pass. */
export async function submitCashOut(ctx: OrderLaneContext, req: CashOutRequest, onPhase?: PhaseListener): Promise<CashOutOutcome> {
  const route = req.route ?? { kind: "wallet" };
  let prepared: PreparedSell | null = null;
  try {
    prepared = await prepareSell(ctx, req, route);
  } catch (error) {
    onPhase?.("composing");
    return notSent(error, null);
  }
  const { paid, series, owner, grantId } = prepared;
  const record = await ctx.journal.record({ kind: "order", wallet: ctx.wallet, summary: summarize(req, route), pool: req.market.poolAddress, marketId: req.market.marketId });
  onPhase?.("submitted");
  const landed = await landOrder(ctx, record.id, await sendPaid(ctx, record.id, paid, onPhase));
  if (route.kind !== "wallet") forgetVaultAccount(owner);
  switch (landed.status) {
    case "not-sent":
      onPhase?.("composing");
      return notSent(landed.error, prepared);
    case "unknown":
      onPhase?.("unknown", { txHash: landed.txHash });
      return landed;
    case "nothingFilled":
      onPhase?.("confirmed", { txHash: landed.txHash });
      return landed;
    case "reverted":
      onPhase?.("reverted", { txHash: landed.txHash });
      return landed;
  }
  const txHash: Signature = landed.txHash;
  if (!landed.tx) {
    onPhase?.("unknown", { txHash });
    return { status: "unknown", diagnosis: diagnosis("send-unknown", "the sell landed but its fills are not readable yet", { txHash }), txHash };
  }
  const booked =
    route.kind === "wallet"
      ? bookSellFromEvents(await decodeWriteEvents(landed.tx), { wallet: ctx.wallet, marketId: req.market.marketId, side: req.side, lotBase: series.lotBase, txHash })
      : bookVaultEvents(await decodeVaultEvents(landed.tx), { owner, marketId: req.market.marketId, side: req.side, grantId, isBuy: false, series, txHash });
  onPhase?.("confirmed", { txHash });
  return booked ? { status: "confirmed", booked } : { status: "nothingFilled", txHash };
}
