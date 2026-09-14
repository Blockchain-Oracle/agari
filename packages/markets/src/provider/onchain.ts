/**
 * Head-fresh Window reads from chain (first-call.md §2.2): the write gate's snapshot, a wallet's seat holdings, and
 * the opening print. A Window whose account is gone (closed after retention) answers from its index row.
 */
import { ONCHAIN_STATUS } from "@agari/core/lifecycle";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type Holdings, type MarketId, type OnchainSnapshot } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { loadAccount } from "../runtime/account-loader";
import { readMarket, readSeat, readSeries, readVenue } from "../runtime/accounts";
import { toOnchainSnapshot, winningOutcomeOf } from "../runtime/mappers";
import { nowSec } from "./clock";
import { big, indexRows, sec, type MarketRow, type PositionRow } from "./index-api";
import { marketRow } from "./markets";
import { rememberOpeningPrint, seenOpeningPrint } from "./opening-prints";
import { withReading } from "./reading";
import { heldAtSettlement } from "./rows";

/** `Market.open` (struct offset 208 + the discriminator): `price` i64 @0, `source` u8 @20. */
const OPEN_PRINT_AT = 216;
/** A Window's Series never changes: once seen, a holdings poll reads only the Ledger. */
const seriesOfMarket = new Map<string, Address>();

/** The closed-Window snapshot, rebuilt from the index row the indexer kept. */
function snapshotFromRow(row: MarketRow, decimals: number, collateral: Address): OnchainSnapshot {
  const state = row.state;
  return {
    marketId: row.market as MarketId,
    marketAddress: row.market as Address,
    pool: (row.book ?? row.market) as Address,
    ledger: (row.ledger ?? row.market) as Address,
    nonce: big(row.market_index),
    collateral,
    status: state === "resolved" ? ONCHAIN_STATUS.Resolved : state === "voided" ? ONCHAIN_STATUS.Voided : ONCHAIN_STATUS.Locked,
    backing: big(row.backing_lots) * big(row.lot_base),
    finalized: state !== "open",
    lockAtSec: sec(row.lock_at_sec),
    expirySec: sec(row.expiry_sec),
    decimals,
    winningOutcome: winningOutcomeOf(Number(row.payout_yes ?? 0), Number(row.payout_no ?? 0)),
    isResolved: state === "resolved",
    isVoided: state === "voided",
  };
}

export async function getOnchain(marketId: MarketId): Promise<Reading<OnchainSnapshot>> {
  return withReading(`onchain:${marketId}`, async () => {
    const [market, venue] = await Promise.all([readMarket(marketId), readVenue()]);
    if (market) {
      seriesOfMarket.set(marketId, market.data.series as string as Address);
      return toOnchainSnapshot(market, await readSeries(market.data.series), venue, nowSec());
    }
    const row = await marketRow(marketId).catch(() => null);
    if (row && row.state !== "open") return snapshotFromRow(row, venue.decimals, venue.collateralMint as string as Address);
    throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  });
}

/** Seat balances (free + locked) for one Window; a seat the settler already paid reads what it held at settlement. */
export async function getHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<Holdings>> {
  return withReading(`holdings:${wallet}:${onchain.marketId}`, async () => {
    const known = seriesOfMarket.get(onchain.marketId);
    const [series, seat] = await Promise.all([
      known ?? readMarket(onchain.marketId).then((market) => market && (seriesOfMarket.set(onchain.marketId, market.data.series as string as Address), market.data.series as string as Address)),
      readSeat(onchain.ledger, wallet),
    ]);
    if (seat?.seat && series) {
      const { lotBase } = await readSeries(series);
      return { upRaw: (seat.seat.yesFree + seat.seat.yesLocked) * lotBase, downRaw: (seat.seat.noFree + seat.seat.noLocked) * lotBase };
    }
    if (!onchain.finalized) return { upRaw: 0n, downRaw: 0n };
    const rows = await indexRows<PositionRow>(`wallet/${wallet}/positions`);
    const row = rows.find((position) => position.market === onchain.marketId);
    if (!row) return { upRaw: 0n, downRaw: 0n };
    const held = heldAtSettlement(row);
    const lotBase = big(row.lot_base);
    return { upRaw: held.upLots * lotBase, downRaw: held.downLots * lotBase };
  });
}

/**
 * The Window's opening print (× 10⁻⁸) off its account; null until recorded. The whole 456 B account is read so a
 * focused Window's print and snapshot polls share one account in one batch.
 */
export async function getOpeningPrice(marketId: MarketId): Promise<Reading<bigint | null>> {
  return withReading(`opening:${marketId}`, async () => {
    const seen = seenOpeningPrint(marketId);
    if (seen !== undefined) return seen;
    const { bytes } = await loadAccount(marketId as string as Parameters<typeof loadAccount>[0]);
    if (!bytes) {
      const open = (await marketRow(marketId))?.prints?.["0"];
      if (open) rememberOpeningPrint(marketId, BigInt(open.price));
      return open ? BigInt(open.price) : null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint8(OPEN_PRINT_AT + 20) === 0) return null;
    const price = view.getBigInt64(OPEN_PRINT_AT, true);
    rememberOpeningPrint(marketId, price);
    return price;
  });
}
