import { describe, expect, it } from "vitest";
import { testAddressFromHex, testMarketIdFromHex } from "../testing/ids";
import type { Hash32 } from "../types/primitives";
import { luckyDrawMessage, mapLuckyDraw } from "./commitment";
import {
  LUCKY_ASSETS,
  LUCKY_MULTIPLIERS,
  LUCKY_POLICY_VERSION,
  chooseLuckyWindow,
  eligibleLuckyWindows,
  impliedMultipleHundredths,
  luckyBestStreak,
  luckyCandidatePreimage,
  luckyDrifted,
  luckyPolicyAssets,
  luckyStreak,
  luckyVerdict,
  targetPriceBps,
  type LuckyCandidate,
  type LuckyResult,
} from "./lucky";

const CLIENT_SEED = `0x${"33".repeat(32)}` as Hash32;
/** The old left-padded 20-byte word, as a 32-byte key: the message bytes (and both golden literals) are unchanged. */
const WALLET = testAddressFromHex(`0x${"00".repeat(12)}aaaa${"00".repeat(17)}01`);

const hexBytes = (hex: string): Uint8Array => Uint8Array.from((hex.slice(2).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

/**
 * The golden vector's two halves. Core has no crypto, so the digest itself is pinned here as a literal and
 * produced by `node:crypto` in `web/src/features/games/lucky/lucky-hmac.test.ts` from this exact message and
 * the server seed `0x22…22`; the browser's WebCrypto check must land on it too. If either literal ever has
 * to change, the policy version changes with it.
 */
const GOLDEN_MESSAGE =
  "0x3333333333333333333333333333333333333333333333333333333333333333" +
  "000000000000000000000000aaaa000000000000000000000000000000000001" +
  "0000000000000000000000000000000000000000000000000000000000000007" +
  "0000000000000000000000000000000000000000000000000000000000000002";
const GOLDEN_DIGEST = "0xaefedfee7e1dc28fd842709c3bb825283102a89ac7e82254ed81d498bce52621";

describe("the draw", () => {
  it("builds the canonical message the HMAC is keyed over", () => {
    expect(luckyDrawMessage({ clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 7, policyVersion: LUCKY_POLICY_VERSION })).toBe(GOLDEN_MESSAGE);
    expect(luckyDrawMessage({ clientSeed: CLIENT_SEED, wallet: WALLET, nonce: 8, policyVersion: LUCKY_POLICY_VERSION })).not.toBe(GOLDEN_MESSAGE);
  });

  it("maps the golden digest to one draw under policy 2, the same way every time", () => {
    const draw = mapLuckyDraw(hexBytes(GOLDEN_DIGEST), { assets: LUCKY_ASSETS, multipliers: LUCKY_MULTIPLIERS });
    expect(draw).toEqual({ asset: "META", side: "up", multiplier: 10 });
    expect(mapLuckyDraw(hexBytes(GOLDEN_DIGEST), { assets: LUCKY_ASSETS, multipliers: LUCKY_MULTIPLIERS })).toEqual(draw);
  });
});

describe("the asset universe", () => {
  it("is what the venue lists, and never the reference's crypto pair", () => {
    expect(LUCKY_ASSETS).toEqual(["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "QQQ", "VOO", "OPENAI"]);
    expect(luckyPolicyAssets(LUCKY_POLICY_VERSION)).toBe(LUCKY_ASSETS);
    expect(luckyPolicyAssets(1)).toBeNull();
  });
});

describe("the candidate set", () => {
  const a = testMarketIdFromHex("a1".repeat(32));
  const b = testMarketIdFromHex("b2".repeat(32));

  it("commits to the same bytes whatever order the scan produced", () => {
    expect(luckyCandidatePreimage([a, b], 1)).toBe(luckyCandidatePreimage([b, a], 1));
    expect(luckyCandidatePreimage([a, b], 1).slice(2)).toHaveLength(4 * 64);
  });

  it("separates sets that differ in a member or the policy", () => {
    expect(luckyCandidatePreimage([a], 1)).not.toBe(luckyCandidatePreimage([a, b], 1));
    expect(luckyCandidatePreimage([a, b], 1)).not.toBe(luckyCandidatePreimage([a, b], 2));
  });
});

describe("eligibility", () => {
  const now = 1_000_000;
  const candidate = (over: Partial<LuckyCandidate>): LuckyCandidate => ({
    marketId: testMarketIdFromHex("c3".repeat(32)),
    asset: "ETH",
    intervalSec: 900,
    expirySec: now + 600,
    trading: true,
    ...over,
  });

  it("keeps only the drawn asset's trading Windows with real life left, soonest first", () => {
    const pool = [
      candidate({ marketId: testMarketIdFromHex("01".repeat(32)), expirySec: now + 3_000 }),
      candidate({ marketId: testMarketIdFromHex("02".repeat(32)), expirySec: now + 600 }),
      candidate({ marketId: testMarketIdFromHex("03".repeat(32)), asset: "BTC" }),
      candidate({ marketId: testMarketIdFromHex("04".repeat(32)), trading: false }),
      candidate({ marketId: testMarketIdFromHex("05".repeat(32)), expirySec: now + 119 }),
      candidate({ marketId: testMarketIdFromHex("06".repeat(32)), intervalSec: 300 }),
    ];
    expect(eligibleLuckyWindows(pool, "ETH", now).map((c) => c.marketId)).toEqual([pool[1]!.marketId, pool[0]!.marketId]);
  });
});

describe("choosing the Window", () => {
  const quote = (id: string, avgPriceBps: number, expirySec: number, partial = false) => ({ marketId: testMarketIdFromHex(id.repeat(32)), avgPriceBps, expirySec, partial });

  it("targets the price that pays the reach", () => {
    expect(targetPriceBps(2)).toBe(5_000);
    expect(targetPriceBps(3)).toBe(3_333);
    expect(targetPriceBps(25)).toBe(400);
    expect(impliedMultipleHundredths(3_400)).toBe(294);
    expect(() => targetPriceBps(1)).toThrow();
  });

  it("takes the closest price, and the soonest expiry on a tie", () => {
    const near = quote("aa", 3_400, 900);
    const far = quote("bb", 5_000, 500);
    expect(chooseLuckyWindow([far, near], 3)).toBe(near);
    const later = quote("cc", 3_300, 1_200);
    const sooner = quote("dd", 3_366, 600);
    expect(chooseLuckyWindow([later, sooner], 3)).toBe(sooner);
  });

  it("never hands out a partial fill, and says null when nothing is fillable", () => {
    expect(chooseLuckyWindow([quote("aa", 3_333, 900, true)], 3)).toBeNull();
    expect(chooseLuckyWindow([], 3)).toBeNull();
  });

  it("flags a live price more than a tenth away from the dealt one", () => {
    expect(luckyDrifted(3_400, 3_600)).toBe(false);
    expect(luckyDrifted(3_400, 3_800)).toBe(true);
    expect(luckyDrifted(3_400, 3_000)).toBe(true);
  });
});

describe("the verdict and the streak", () => {
  const rows = (...results: LuckyResult[]) => results.map((result) => ({ result }));

  it("reads the chain's outcome against the held side", () => {
    expect(luckyVerdict("up", 0, false)).toBe("won");
    expect(luckyVerdict("down", 0, false)).toBe("lost");
    expect(luckyVerdict("down", 1, false)).toBe("won");
    expect(luckyVerdict("up", 0, true)).toBe("void");
    expect(luckyVerdict("up", null, false)).toBe("void");
  });

  it("counts consecutive wins from the newest verified row and stops at a loss", () => {
    expect(luckyStreak(rows("won", "won", "lost", "won"))).toBe(2);
    expect(luckyStreak(rows("lost", "won"))).toBe(0);
    expect(luckyStreak([])).toBe(0);
  });

  it("skips what the chain has not decided — pending, refused, unknown, cashed-out and void", () => {
    expect(luckyStreak(rows("pending", "won", "void", "refused", "won", "cashed-out", "lost"))).toBe(2);
  });

  it("finds the longest run for the board's best", () => {
    expect(luckyBestStreak(rows("won", "lost", "won", "won", "won", "void", "lost", "won"))).toBe(3);
    expect(luckyBestStreak(rows("pending"))).toBe(0);
  });
});
