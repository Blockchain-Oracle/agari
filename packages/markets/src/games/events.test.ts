import { getMatchCreatedEventEncoder, getPickFilledEventEncoder } from "@agari/clients/agari-arena";
import { getBase64Decoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { arenaEventsOf, decodeArenaEvent } from "./events";

const ARENA = "CakGVH2CaM2YAF9edgMTrCv1HCFf5tgbTcinN24JWvR3";
const EVENTS = "cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH";
const PLAYER = "EfTzYtM22yPbriCaFaKEK7pMrWoEfmFoqNtp8vDELmgp";
const MARKET = "HSLt1X2JUzDhDWnhhEWyKpwkjJY16d4pjf1xNm9Vktmt";
const id = new Uint8Array(32).fill(0x11);
const b64 = (bytes: ArrayLike<number>) => getBase64Decoder().decode(Uint8Array.from(Array.from(bytes)));

const picked = b64(getPickFilledEventEncoder().encode({ matchId: id, player: PLAYER as never, market: MARKET as never, cardIndex: 2, outcome: 1, quantityRaw: 1_923_000n, costBase: 999_960n, refundBase: 40n }));
const created = b64(getMatchCreatedEventEncoder().encode({ matchId: id, creator: PLAYER as never, challenger: MARKET as never, tier: 1, potBase: 1_000_000n, deckHash: new Uint8Array(32).fill(9), deckSize: 3, joinDeadlineSec: 1_789_900_180n }));

describe("the arena's events out of a transaction's logs", () => {
  it("decodes an event into core's vocabulary, outcome 1 as Down and ids as hex", () => {
    expect(decodeArenaEvent(picked)).toEqual({ kind: "picked", matchId: `0x${"11".repeat(32)}`, player: PLAYER, marketId: MARKET, cardIndex: 2, pick: "down", quantity: 1_923_000n, costBase: 999_960n, refundBase: 40n });
    expect(decodeArenaEvent(created)).toMatchObject({ kind: "created", tier: 1, potBase: 1_000_000n, deckSize: 3, joinDeadlineSec: 1_789_900_180 });
    expect(decodeArenaEvent("not base64 at all !!")).toBeNull();
    expect(decodeArenaEvent(b64([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBeNull();
  });

  it("counts only what the arena itself logged, in log order, never the engine's lines inside its CPI", () => {
    const logs = [
      `Program ${ARENA} invoke [1]`,
      "Program log: Instruction: PlayerPlacePick",
      `Program ${EVENTS} invoke [2]`,
      // The engine's own event, logged inside the arena's CPI. It even carries arena-shaped bytes here, and still does not count.
      `Program data: ${picked}`,
      `Program ${EVENTS} success`,
      `Program data: ${picked}`,
      `Program data: ${created}`,
      `Program ${ARENA} success`,
    ];
    expect(arenaEventsOf(logs, ARENA).map((e) => e.kind)).toEqual(["picked", "created"]);
    expect(arenaEventsOf(logs, EVENTS).map((e) => e.kind)).toEqual(["picked"]);
  });
});
