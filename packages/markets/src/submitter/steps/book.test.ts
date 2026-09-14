import { readFileSync } from "node:fs";
import { toAddress, toMarketId, toSignature } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import type { JsonTransaction } from "../events";
import { decodeWriteEvents } from "../events";
import { bookFromEvents } from "./book";

const fixture = JSON.parse(readFileSync(new URL("../../ops/indexer/fixtures/place-order-direct-yes-fill.json", import.meta.url), "utf8")) as {
  transaction: JsonTransaction;
};
const signature = toSignature(fixture.transaction.transaction.signatures[0]!);
const market = toMarketId("4SCCa1z6oYARC8BNPHsuCaaTdycuN6wuYGADgeBBMgki");
const LOT_BASE = 1_000n;

describe("bookFromEvents", () => {
  it("books a real devnet IOC fill from its OrderExecuted: 1,000 lots @ 700 → 1 contract for 0.70 tUSDC", async () => {
    const events = await decodeWriteEvents(fixture.transaction);
    const executed = events.find((e) => e.name === "OrderExecuted");
    expect(executed?.name).toBe("OrderExecuted");
    const taker = toAddress(executed!.data.taker);

    const booked = bookFromEvents(events, { wallet: taker, marketId: market, side: "up", lotBase: LOT_BASE, txHash: signature });
    expect(booked).toEqual({ marketId: market, side: "up", contractsRaw: 1_000_000n, costBase: 700_000n, avgPriceBps: 7_000, txHash: signature, fillCount: 1 });
  });

  it("books nothing for another wallet, another Window, or a failed transaction", async () => {
    const events = await decodeWriteEvents(fixture.transaction);
    const taker = toAddress((events[0]!.data as { taker: string }).taker);
    const other = toAddress("DcCD3pcMnnnfigaS5BzyKCkcyLxDjhcDutQKcYYuzZvP");
    expect(bookFromEvents(events, { wallet: other, marketId: market, side: "up", lotBase: LOT_BASE, txHash: signature })).toBeNull();
    expect(bookFromEvents(events, { wallet: taker, marketId: toMarketId(other), side: "up", lotBase: LOT_BASE, txHash: signature })).toBeNull();
    const failed = { ...fixture.transaction, meta: { ...fixture.transaction.meta!, err: { InstructionError: [1, { Custom: 6110 }] } } };
    expect(await decodeWriteEvents(failed)).toEqual([]);
  });
});
