import { describe, expect, it } from "vitest";
import type { EventMarket } from "@agari/core/types";
import type { HedgePick } from "@/features/hedge";
import { HOLDING_EVERY, weaveReel } from "./weave";
import type { FeedTake } from "./protocol";

const market = (id: string) => ({ marketId: id }) as unknown as EventMarket;
const take = (id: string) => ({ id }) as unknown as FeedTake;
const pick = (underlying: string) => ({ underlying }) as unknown as HedgePick;

describe("weaveReel", () => {
  it("alternates market, take, market, take and starts on a market", () => {
    const kinds = weaveReel([market("a"), market("b")], [take("t1")]).map((i) => i.kind);
    expect(kinds).toEqual(["market", "take", "market"]);
  });
  it("weaves one holding card in every HOLDING_EVERY items, rotating through what the wallet holds (plan Step 7)", () => {
    const rounds = Array.from({ length: 14 }, (_, i) => market(`m${i}`));
    const takes = Array.from({ length: 14 }, (_, i) => take(`t${i}`));
    const out = weaveReel(rounds, takes, [pick("OPENAI"), pick("TSLA")]);
    const holdings = out.map((item, index) => (item.kind === "holding" ? { index, underlying: item.pick.underlying } : null)).filter((x) => x !== null);
    expect(out[0]!.kind).toBe("market");
    expect(holdings.map((h) => h.index)).toEqual([HOLDING_EVERY, 2 * HOLDING_EVERY + 1, 3 * HOLDING_EVERY + 2]);
    expect(holdings.map((h) => h.underlying)).toEqual(["OPENAI", "TSLA", "OPENAI"]);
  });
  it("gives a short feed one holding card at the end, and none at all without a live pick", () => {
    expect(weaveReel([market("a"), market("b")], [], [pick("OPENAI")]).map((i) => i.kind)).toEqual(["market", "market", "holding"]);
    expect(weaveReel([market("a")], [], []).map((i) => i.kind)).toEqual(["market"]);
    expect(weaveReel([], [], [pick("OPENAI")])).toEqual([]);
  });
});
