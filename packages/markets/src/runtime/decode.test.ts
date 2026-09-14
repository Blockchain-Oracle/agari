import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bookLevels, outcomeLevels, quoteStake, type BookLevel, type NodeFilter, type TakerKind } from "@agari/core/market";
import type { Address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import vectors from "../../../../anchor/tests/vectors/book.vectors.json";
import { bookBytes } from "./book-bytes.fixture";
import { decodeBook } from "./decode";

const BOOK = "Cmt4NQVMTP78iLqJb4ESydyWx2uNM2992q8rUtgJtKfo" as Address;
const FREE = "11111111111111111111111111111111";
const wire = (levels: readonly BookLevel[]) => levels.map(([p, q]) => [p, String(q)]);

describe("decodeBook matches the shared book vectors", () => {
  it.each(vectors.cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    const book = decodeBook(BOOK, bookBytes(c.bids, c.asks), BigInt(c.filter.slot));
    const f: NodeFilter = { now: BigInt(c.filter.now), slot: BigInt(c.filter.slot), restedOnly: c.filter.restedOnly, minRestSlots: BigInt(c.filter.minRestSlots) };
    const e = c.expect;
    expect(wire(bookLevels(book.bids, "bid", c.n, f))).toEqual(e.bidLevels);
    expect(wire(bookLevels(book.asks, "ask", c.n, f))).toEqual(e.askLevels);
    for (const kind of ["BUY_YES", "SELL_YES", "BUY_NO", "SELL_NO"] as const) {
      expect(wire(outcomeLevels(kind as TakerKind, book.bids, book.asks, c.n, f))).toEqual(e.outcome[kind]);
    }
    for (const q of e.quotes) {
      const side = q.side as "BUY_YES" | "BUY_NO";
      const r = quoteStake(outcomeLevels(side, book.bids, book.asks, 32, f), side, BigInt(q.stake), BigInt(q.cu), BigInt(q.minLots), q.slippageBps, q.minTicks);
      expect(r && { limitTicks: r.limitTicks, yesPriceTicks: r.yesPriceTicks, lots: String(r.lots), escrowCash: String(r.escrowCash) }).toEqual(q.result);
    }
    expect(book.market).toBe(FREE);
    expect(book.orderCount).toBe([...c.bids, ...c.asks].filter((o) => o.live).length);
  });
});

/** The ops maker's `readBookTop` reads each level's `live_lots` directly; the node walk must agree with it level by level. */
function levelLiveLots(bytes: Uint8Array, levelsAt: number, price: number): bigint {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(levelsAt + 16 * price + 8, true);
}

function agreesWithLevelTotals(bytes: Uint8Array, slot: bigint): void {
  const book = decodeBook(BOOK, bytes, slot);
  const everything: NodeFilter = { now: 0n, slot, restedOnly: false, minRestSlots: 0n };
  const walked = (side: "bid" | "ask") => new Map(bookLevels(side === "bid" ? book.bids : book.asks, side, 999, everything));
  for (const [side, levelsAt] of [["bid", 392], ["ask", 16_392]] as const) {
    const levels = walked(side);
    for (let price = 1; price <= 999; price++) expect(levels.get(price) ?? 0n).toBe(levelLiveLots(bytes, levelsAt, price));
  }
}

describe("decodeBook on account bytes", () => {
  it("walks to each level's live_lots on a Book with resting, dead and FIFO orders", () => {
    const at = (price: number, lots: bigint, live = true) => ({ price, lots, expireTs: 1_789_156_860n, placedSlot: 400_000_000n, live });
    const bytes = bookBytes([at(480, 5_000n), at(480, 700n), at(470, 9n, false)], [at(520, 5_000n), at(530, 1n)], "8xPqjTVYdsu2f4fZo2EDuhkSxFrioZECnypZKfqW97m2" as Address, 512);
    agreesWithLevelTotals(bytes, 400_000_100n);
    const book = decodeBook(BOOK, bytes, 400_000_100n);
    expect(book.market).toBe("8xPqjTVYdsu2f4fZo2EDuhkSxFrioZECnypZKfqW97m2");
    expect(book.bids.nodes).toHaveLength(5);
    expect(book.orderCount).toBe(4);
  });

  it("decodes a captured devnet Book (released after its Window settled) as free, empty and consistent", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/book-devnet-released.json", import.meta.url), "utf8")) as { address: string; slot: string; dataGzipBase64: string };
    const bytes = new Uint8Array(gunzipSync(Buffer.from(fixture.dataGzipBase64, "base64")));
    expect(bytes.byteLength).toBe(32_392 + 48 * 512);
    const slot = BigInt(fixture.slot);
    const book = decodeBook(fixture.address as Address, bytes, slot);
    agreesWithLevelTotals(bytes, slot);
    expect(book.market).toBe(FREE);
    expect(book.orderCount).toBe(0);
    expect(book.generation).toBeGreaterThan(0);
    // The seed maker's last bid and ask were freed at release: still allocated below high_water, no longer LIVE.
    expect(book.bids.nodes.length).toBeGreaterThan(0);
    expect(book.bids.nodes.every((node) => !node.live)).toBe(true);
  });
});
