import { ok } from "@masayume/core/schemas";
import type { BookDepth, BookLevelView } from "@masayume/core/types";
import { describe, expect, it } from "vitest";
import { decideBookEmit, reuseBookValue, sameBookDepth } from "./book-reading";

const DECIMALS = 6;

/** `priceBps` is derived from `priceRaw`, so it never distinguishes two levels; a fixed one keeps that plain. */
function level(priceRaw: bigint, quantityRaw: bigint, priceBps = 5_200): BookLevelView {
  return { priceRaw, priceBps, quantityRaw };
}

function book(upAsks: BookLevelView[] = [], downAsks: BookLevelView[] = []): BookDepth {
  return { upBids: [], upAsks, downBids: [], downAsks, decimals: DECIMALS };
}

describe("sameBookDepth", () => {
  it("matches two separately-mapped books with the same liquidity", () => {
    expect(sameBookDepth(book([level(52n, 200n)]), book([level(52n, 200n)]))).toBe(true);
  });

  it("separates a changed quantity at the same price", () => {
    expect(sameBookDepth(book([level(52n, 200n)]), book([level(52n, 199n)]))).toBe(false);
  });

  it("separates a changed price at the same quantity", () => {
    expect(sameBookDepth(book([level(52n, 200n)]), book([level(53n, 200n)]))).toBe(false);
  });

  it("separates a level appearing on the other side", () => {
    expect(sameBookDepth(book([level(52n, 200n)]), book([level(52n, 200n)], [level(48n, 10n)]))).toBe(false);
  });

  it("separates a level being pulled", () => {
    expect(sameBookDepth(book([level(52n, 200n), level(53n, 10n)]), book([level(52n, 200n)]))).toBe(false);
  });

  it("separates the same numbers under different decimals", () => {
    expect(sameBookDepth(book([level(52n, 200n)]), { ...book([level(52n, 200n)]), decimals: DECIMALS + 1 })).toBe(false);
  });
});

describe("reuseBookValue", () => {
  it("hands back the previous object when nothing moved, so downstream memos hold", () => {
    const previous = book([level(52n, 200n)]);
    expect(reuseBookValue(previous, book([level(52n, 200n)]))).toBe(previous);
  });

  it("hands back the new object once liquidity moves", () => {
    const next = book([level(52n, 199n)]);
    expect(reuseBookValue(book([level(52n, 200n)]), next)).toBe(next);
  });
});

describe("decideBookEmit", () => {
  const value = book([level(52n, 200n)]);

  it("emits the first reading", () => {
    const decision = decideBookEmit(null, value, true, 1_000);
    expect(decision.hold).toBe(false);
    if (decision.hold) return;
    expect(decision.reading).toEqual({ ok: true, value, asOfMs: 1_000, stale: false });
  });

  it("holds while the same value stays live — this is what stops a re-render every block", () => {
    const previous = ok(value, 1_000);
    expect(decideBookEmit(previous, value, true, 9_000).hold).toBe(true);
  });

  it("emits when the value object changes", () => {
    expect(decideBookEmit(ok(value, 1_000), book([level(52n, 199n)]), true, 2_000).hold).toBe(false);
  });

  it("emits going offline, stamped with the last live confirmation rather than the last change", () => {
    const decision = decideBookEmit(ok(value, 1_000), value, false, 9_000);
    expect(decision.hold).toBe(false);
    if (decision.hold) return;
    expect(decision.reading.stale).toBe(true);
    expect(decision.reading.staleReason).toBe("offline");
    expect(decision.reading.asOfMs).toBe(9_000);
  });

  it("holds while an unchanged book stays offline", () => {
    const offline = decideBookEmit(ok(value, 1_000), value, false, 9_000);
    if (offline.hold) throw new Error("expected the offline transition to emit");
    expect(decideBookEmit(offline.reading, value, false, 9_000).hold).toBe(true);
  });

  it("emits again when the connection comes back", () => {
    const offline = decideBookEmit(ok(value, 1_000), value, false, 9_000);
    if (offline.hold) throw new Error("expected the offline transition to emit");
    const back = decideBookEmit(offline.reading, value, true, 12_000);
    expect(back.hold).toBe(false);
    if (back.hold) return;
    expect(back.reading.stale).toBe(false);
    expect(back.reading.asOfMs).toBe(12_000);
  });
});
