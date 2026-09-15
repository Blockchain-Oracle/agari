import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import { isMarketId, type MarketId } from "@agari/core/types";
import { z } from "zod";

/**
 * Which Room a thread, a token and a join signature belong to (social-assistant.md §1.2).
 *
 * A Window's Room is its `MarketId` (base58), as Masayume's per-round Rooms are. A ticker's Room is `$` and the
 * registry ticker (`$TSLA`): one standing thread for everyone who ever traded that stock. `$` is not in the base58
 * alphabet, so the two kinds can never collide in `room_comments.market_id` or a token.
 */
export type TickerRoomId = `$${TickerSymbol}`;
export type RoomId = MarketId | TickerRoomId;

export type RoomRef = { kind: "window"; roomId: MarketId; marketId: MarketId } | { kind: "ticker"; roomId: TickerRoomId; symbol: TickerSymbol };

const TICKER_PREFIX = "$";

export function tickerRoomId(symbol: TickerSymbol): TickerRoomId {
  return `${TICKER_PREFIX}${symbol}`;
}

/** The Room a string names, or null when it names none. Tickers are matched exactly (`$tsla` is not `$TSLA`). */
export function parseRoomId(value: string): RoomRef | null {
  if (value.startsWith(TICKER_PREFIX)) {
    const symbol = value.slice(TICKER_PREFIX.length);
    return isTickerSymbol(symbol) ? { kind: "ticker", roomId: tickerRoomId(symbol), symbol } : null;
  }
  return isMarketId(value) ? { kind: "window", roomId: value, marketId: value } : null;
}

export const isRoomId = (value: unknown): value is RoomId => typeof value === "string" && parseRoomId(value) !== null;

export const roomIdSchema = z.custom<RoomId>(isRoomId, "expected a Market id or a $TICKER room");
