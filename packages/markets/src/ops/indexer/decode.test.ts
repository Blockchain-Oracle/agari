import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeTransactionEvents, type RawTransaction } from "./decode";
import { AGARI_EVENTS_PROGRAM_ID, eventAuthorityOf } from "./rpc";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/place-order-direct-yes-fill.json", import.meta.url), "utf8")) as { transaction: RawTransaction };

describe("decodeTransactionEvents", () => {
  it("decodes the emit_cpi! OrderExecuted of a real devnet fill, and ignores it under another program id", async () => {
    const authority = await eventAuthorityOf();
    const { events, failed, slot } = decodeTransactionEvents(fixture.transaction, AGARI_EVENTS_PROGRAM_ID, authority);
    expect(failed).toBe(false);
    expect(slot).toBe(498288417);
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toMatchObject({ name: "OrderExecuted", outerIx: 1, innerIx: 1, market: "4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki", seq: "7" });
    expect(event!.data).toMatchObject({ kind: 0, orderType: 2, limitPrice: 710, filledLots: "1000", cashSpent: "700000", restedLots: "0" });
    expect(event!.data.fills).toEqual([
      { maker: "DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP", makerSeat: 0, makerNode: 1, makerSeq: "1", makerKind: 1, path: 0, price: 700, lots: "1000", makerRemaining: "1000" },
    ]);
    expect(decodeTransactionEvents(fixture.transaction, "11111111111111111111111111111111", authority).events).toEqual([]);
  });
});
