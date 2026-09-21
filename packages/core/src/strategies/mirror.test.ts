import { describe, expect, it } from "vitest";
import type { LedgerFill } from "../projection/types";
import { decideMirror, netYesRaw } from "./mirror";
import type { MirrorSpec } from "./types";

const NOW = 1_800_000_000_000;
const TRADER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PQFsz1" as MirrorSpec["trader"];
const SPEC: MirrorSpec = { preset: "mirror", trader: TRADER, withinSec: 120 };

const fill = (side: LedgerFill["side"], quantityRaw: bigint, agoSec = 0): LedgerFill => ({
  marketId: "m" as LedgerFill["marketId"],
  side,
  quantityRaw,
  yesPriceRaw: 500_000n,
  atMs: NOW - agoSec * 1_000,
  txHash: "sig" as LedgerFill["txHash"],
});

describe("netYesRaw", () => {
  it("counts buying NO and selling YES as the same lean", () => {
    expect(netYesRaw([fill("BUY_YES", 10n)])).toBe(10n);
    expect(netYesRaw([fill("SELL_NO", 10n)])).toBe(10n);
    expect(netYesRaw([fill("BUY_NO", 10n)])).toBe(-10n);
    expect(netYesRaw([fill("SELL_YES", 10n)])).toBe(-10n);
  });
  it("nets a trader who bought and sold back", () => {
    expect(netYesRaw([fill("BUY_YES", 10n), fill("SELL_YES", 4n)])).toBe(6n);
    expect(netYesRaw([fill("BUY_YES", 10n), fill("SELL_YES", 10n)])).toBe(0n);
  });
});

describe("decideMirror", () => {
  it("takes the side the trader is net on", () => {
    expect(decideMirror({ fills: [fill("BUY_YES", 10n, 5)], spec: SPEC, nowMs: NOW }).side).toBe("up");
    expect(decideMirror({ fills: [fill("BUY_NO", 10n, 5)], spec: SPEC, nowMs: NOW }).side).toBe("down");
  });
  it("sits out a trader who has not traded inside the window of interest", () => {
    const stale = decideMirror({ fills: [fill("BUY_YES", 10n, 300)], spec: SPEC, nowMs: NOW });
    expect(stale.side).toBeNull();
    expect(stale.reason).toContain("no call from this trader");
  });
  it("sits out a trader who bought and sold back to flat", () => {
    const flat = decideMirror({ fills: [fill("BUY_YES", 10n, 5), fill("SELL_YES", 10n, 2)], spec: SPEC, nowMs: NOW });
    expect(flat.side).toBeNull();
    expect(flat.reason).toContain("flat on this Window");
  });
  it("copies the remainder when a trader only sold part of it back", () => {
    const partial = decideMirror({ fills: [fill("BUY_YES", 10n, 5), fill("SELL_YES", 4n, 2)], spec: SPEC, nowMs: NOW });
    expect(partial.side).toBe("up");
    expect(partial.reason).toContain("net 6 contracts");
  });
  it("ignores the stale half of a mixed history — a call reversed an hour ago is not today's", () => {
    const mixed = decideMirror({ fills: [fill("BUY_NO", 50n, 4_000), fill("BUY_YES", 3n, 10)], spec: SPEC, nowMs: NOW });
    expect(mixed.side).toBe("up");
    expect(mixed.reason).toContain("1 fill");
  });
  it("says nothing at all when the trader never touched the Window", () => {
    expect(decideMirror({ fills: [], spec: SPEC, nowMs: NOW }).side).toBeNull();
  });
});
