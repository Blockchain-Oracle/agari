import { fetchMaybeBudget, fetchMaybeDesk, fetchMaybeKeyMark, fetchMaybeSlot, type Slot } from "@agari/clients/agari-private";
import { CLUSTER_ID, DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import { walkBudget, walkQuantity } from "@agari/core/leverage";
import type { PrivateBudget, PrivateDeskState, PrivateParams, PrivateQuote, PrivateSlot } from "@agari/core/private";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type Hash32, type MarketId, type Side } from "@agari/core/types";
import { ceilDiv } from "@agari/core/units";
import { ReadingError } from "../errors/reading-error";
import { readBoostBook } from "../leverage/book";
import { nowMs, nowSec } from "../provider/clock";
import { withReading } from "../provider/reading";
import { requireProgramSeat } from "../runtime/program-seat";
import { peekClient } from "../runtime/read-runtime";
import { solana } from "../runtime/solana";
import { budgetAddress, chargeMarkAddress, creditMarkAddress, deskAddress, kit, privateProgramId, seatAddress, slotAddress } from "./deployment";

/** What a private bet can spend: the balance, never more than the desk may spend. */
export function toPrivateBudget(balanceBase: bigint, allowanceBase: bigint): PrivateBudget {
  return { balanceBase, allowanceBase, spendableBase: allowanceBase < balanceBase ? allowanceBase : balanceBase };
}

export async function readDesk() {
  const address = await deskAddress();
  const account = await fetchMaybeDesk(solana().rpc, kit(address));
  return account.exists ? { address, data: account.data } : null;
}

const paramsOf = (raw: { minStakeBase: bigint; maxStakeBase: bigint; minTimeLeftSec: number }): PrivateParams => ({ ...raw });

/** The desk's own sheet: who signs, what it owes, and its tunables. `null`, not an error, when there is no desk on this cluster. */
export function getPrivateDeskState(): Promise<Reading<PrivateDeskState | null>> {
  return withReading("private:desk", async () => {
    if (!privateProgramId()) return null;
    const desk = await readDesk();
    if (!desk) return null;
    return {
      // The cluster id is part of the authorisation a wallet signs (`privateOpenMessage`), and the desk rebuilds
      // that text with its own. A placeholder 0 here — which every other product deployment can afford, because
      // none of them signs anything with it — meant the browser signed for chain 0 and the desk verified against
      // devnet, so every private bet from the app was refused "authorisation was not signed by the owner".
      deployment: { chainId: CLUSTER_ID[(peekClient()?.cluster ?? DEFAULT_CLUSTER) as Cluster], privateDesk: desk.address, fromBlock: 0n },
      params: paramsOf(desk.data.params),
      desk: desk.data.desk as string as Address,
      paused: desk.data.paused,
      poolBase: desk.data.poolBase,
      owedBase: desk.data.owedBase,
      inSlotsBase: desk.data.inSlotsBase,
      decimals: 6,
    } satisfies PrivateDeskState;
  });
}

export async function readBudget(owner: Address): Promise<PrivateBudget> {
  const account = await fetchMaybeBudget(solana().rpc, kit(await budgetAddress(owner)));
  return account.exists ? toPrivateBudget(account.data.balanceBase, account.data.allowanceBase) : toPrivateBudget(0n, 0n);
}

export function getPrivateBudget(owner: Address): Promise<Reading<PrivateBudget>> {
  return withReading(`private:budget:${owner}`, () => readBudget(owner));
}

function slotOf(slotId: Hash32, raw: Slot): PrivateSlot {
  const minted = raw.mintedAtSec > 0n;
  return {
    slotId,
    marketId: minted ? (raw.market as string as MarketId) : null,
    side: minted ? (raw.outcome === 0 ? "up" : "down") : null,
    fundedAtSec: Number(raw.fundedAtSec),
    mintedAtSec: Number(raw.mintedAtSec),
    settledAtSec: Number(raw.settledAtSec),
    expirySec: Number(raw.expirySec),
    quantityRaw: raw.lots * raw.lotBase,
    balanceBase: raw.balanceBase,
    costBase: raw.costBase,
    payoutBase: raw.payoutBase,
    sweptBase: raw.sweptBase,
  };
}

/** A slot as the chain records it. One that was never funded reads as an empty slot, which is what it is. */
export async function readSlot(slotId: Hash32): Promise<PrivateSlot> {
  const account = await fetchMaybeSlot(solana().rpc, kit(await slotAddress(slotId)));
  if (account.exists) return slotOf(slotId, account.data);
  return { slotId, marketId: null, side: null, fundedAtSec: 0, mintedAtSec: 0, settledAtSec: 0, expirySec: 0, quantityRaw: 0n, balanceBase: 0n, costBase: 0n, payoutBase: 0n, sweptBase: 0n };
}

export function getPrivateSlot(slotId: Hash32): Promise<Reading<PrivateSlot | null>> {
  return withReading(`private:slot:${slotId}`, async () => {
    const slot = await readSlot(slotId);
    return slot.fundedAtSec === 0 ? null : slot;
  });
}

/** What one key has already moved: zero when it has never been used. How a resumed open or cash-out sees what landed. */
export async function readCharged(owner: Address, chargeKey: Hash32): Promise<bigint> {
  const mark = await fetchMaybeKeyMark(solana().rpc, kit(await chargeMarkAddress(owner, chargeKey)));
  return mark.exists ? mark.data.amountBase : 0n;
}

export async function readCredited(owner: Address, creditKey: Hash32): Promise<bigint> {
  const mark = await fetchMaybeKeyMark(solana().rpc, kit(await creditMarkAddress(owner, creditKey)));
  return mark.exists ? mark.data.amountBase : 0n;
}

/**
 * The stake-first quote, by the chain's own steps (`desk_mint_in_slot`): the whole stake is the budget, the size is
 * what it buys off every live order on the taken side, floored to the lot, and the cost is that walk's. The book is
 * read through the same walk the leverage reserve's quote uses, because the programs share it (`agari_common::stake_walk`).
 */
export function sizePrivateForStake(marketId: MarketId, side: Side, stakeBase: bigint): Promise<Reading<PrivateQuote>> {
  return withReading(`private:size:${marketId}:${side}:${stakeBase}`, async () => {
    const [book, desk] = await Promise.all([readBoostBook(marketId, side), readDesk()]);
    if (!desk) throw new ReadingError(diagnosis("not-deployed", "no private desk on this cluster"));
    if (desk.data.paused) throw new ReadingError(diagnosis("market-not-trading", "private mode is paused"));
    const { minStakeBase, maxStakeBase, minTimeLeftSec } = desk.data.params;
    if (stakeBase < minStakeBase || stakeBase > maxStakeBase) throw new ReadingError(diagnosis("outside-band", `a private stake is ${minStakeBase} to ${maxStakeBase}`));
    if (book.expirySec - nowSec() < minTimeLeftSec) throw new ReadingError(diagnosis("market-not-trading", `private bets close ${minTimeLeftSec}s before the Window ends`));
    await requireProgramSeat("private mode", marketId, book.ledger, await seatAddress());

    const invert = side === "down";
    const quantityRaw = walkBudget(book.entry, invert, book.one, stakeBase, book.lotRaw);
    const least = book.minQuantityRaw > book.lotRaw ? book.minQuantityRaw : book.lotRaw;
    if (quantityRaw < least) throw new ReadingError(diagnosis(book.entry.length === 0 ? "no-liquidity" : "below-min-quantity", `this stake buys ${quantityRaw}, under the venue's minimum ${least}`));
    const walk = walkQuantity(book.entry, invert, book.one, quantityRaw);
    return {
      side,
      stakeBase,
      quantityRaw,
      costBase: walk.costBase,
      limitYesRaw: walk.limitYesRaw,
      priceRaw: ceilDiv(walk.costBase * book.one, quantityRaw),
      decimals: book.decimals,
      quotedAtMs: nowMs(),
    } satisfies PrivateQuote;
  });
}
