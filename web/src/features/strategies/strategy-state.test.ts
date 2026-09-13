import { describe, expect, it } from "vitest";
import type { StrategySubscription } from "@masayume/core/strategies";
import type { VaultGrant } from "@masayume/core/vault";
import { copyProgressKey, matchesProgressGrant, parseCopyProgress, type CopyProgress } from "./copy-progress";
import { strategyIdentity } from "./identity";
import { copyStateOf } from "./lifecycle";
import { initialStudioDraft, studioReadKey } from "./studio-draft";
import { parseAmount } from "./format";

const RUNNER = "0x1111111111111111111111111111111111111111";
const CARD = { strategyId: "1", active: true, runner: RUNNER, metadata: "" };
const SUB: StrategySubscription = { strategyId: 1n, subscriber: RUNNER, grantId: 8n, subscribedAtSec: 10, active: true, live: true };
const GRANT: VaultGrant = { grantId: 8n, owner: RUNNER, actor: RUNNER, kind: "strategy", revoked: false, expiresAtSec: 200, spentDay: 0, spentTodayBase: 0n, openPositions: 0, caps: { maxStakePerTradeBase: 1n, maxDailySpendBase: 5n, maxOpenPositions: 1, maxPriceRaw: 0n }, budgetBase: 5n };

describe("copy lifecycle", () => {
  it("requires readable consent and the same live, funded, unexpired grant", () => {
    expect(copyStateOf(CARD, SUB, GRANT, 100)).toBe("copying");
    expect(copyStateOf(CARD, SUB, GRANT, 100, false)).toBe("checking");
    expect(copyStateOf(CARD, null, GRANT, 100)).toBe("not-copying");
    expect(copyStateOf(CARD, { ...SUB, active: false }, GRANT, 100)).toBe("paused");
    expect(copyStateOf(CARD, SUB, { ...GRANT, revoked: true }, 100)).toBe("paused");
    expect(copyStateOf(CARD, SUB, { ...GRANT, grantId: 9n }, 100)).toBe("replaced");
    expect(copyStateOf(CARD, SUB, GRANT, 200)).toBe("expired");
    expect(copyStateOf({ ...CARD, runner: `0x${"2".repeat(40)}` }, SUB, GRANT, 100)).toBe("runner-changed");
    expect(copyStateOf(CARD, SUB, { ...GRANT, budgetBase: 0n }, 100)).toBe("unfunded");
    expect(copyStateOf({ ...CARD, active: false }, SUB, GRANT, 100)).toBe("inactive");
  });
});

describe("durable identity and draft validity", () => {
  it("retains the same name and portrait across a runner replacement", () => {
    const metadata = JSON.stringify({ name: "Opening reader", portraitSeed: "chosen-portrait", spec: { preset: "momentum", lookback: 6, thresholdBps: 20 } });
    const before = strategyIdentity({ ...CARD, metadata });
    expect(before).toEqual({ name: "Opening reader", seed: "chosen-portrait" });
    expect(strategyIdentity({ ...CARD, metadata, runner: "another runner" })).toEqual(before);
    expect(strategyIdentity({ ...CARD, runner: "another runner" })).toEqual(strategyIdentity(CARD));
  });
  it("invalidates a read for every behavior and spending-limit edit", () => {
    const draft = { ...initialStudioDraft(RUNNER), persona: "Follow a clear opening move." };
    for (const patch of [{ persona: "Hold when depth is thin." }, { posture: "guarded" as const }, { cadences: [900] }, { maxPerTrade: "2" }, { maxDaily: "6" }, { preset: "momentum" as const }, { hosting: "self" as const, agent: RUNNER }]) expect(studioReadKey({ ...draft, ...patch })).not.toBe(studioReadKey(draft));
    expect(studioReadKey({ ...draft, name: "A new name", portraitSeed: "new face" })).toBe(studioReadKey(draft));
  });
  it("refuses malformed amounts instead of turning a negative or exponent into another amount", () => {
    expect(parseAmount("1.25", 6)).toBe(1_250_000n);
    for (const value of ["-5", "1e3", "1.2.3", "ten", "1,000,000"]) expect(parseAmount(value, 6)).toBe(0n);
  });
});

describe("stored copy progress", () => {
  const progress: CopyProgress = { strategyId: "1", runner: RUNNER, stage: "subscribe-ready", previousGrantId: "7", grantId: "8", grantTx: null, subscribeTx: null, budgetBase: "5", feeBase: "0", expiresAtSec: 200, caps: { maxStakePerTradeBase: "1", maxDailySpendBase: "5", maxOpenPositions: 1, maxPriceRaw: "0" } };
  it("validates stored data and isolates each wallet and deployment", () => {
    expect(parseCopyProgress(JSON.stringify(progress))).toEqual(progress);
    expect(parseCopyProgress('{"stage":"subscribe-ready"}')).toBeNull();
    expect(parseCopyProgress("broken")).toBeNull();
    expect(copyProgressKey("0xAAA", "0xBBB")).toBe(copyProgressKey("0xaaa", "0xbbb"));
    expect(copyProgressKey("0xAAA", "0xBBB")).not.toBe(copyProgressKey("0xCCC", "0xBBB"));
  });
  it("recognizes the exact known permission even after its budget has decreased", () => {
    expect(matchesProgressGrant(progress, GRANT)).toBe(true);
    expect(matchesProgressGrant(progress, { ...GRANT, budgetBase: 3n })).toBe(true);
    expect(matchesProgressGrant({ ...progress, grantId: null }, { ...GRANT, budgetBase: 3n })).toBe(false);
    expect(matchesProgressGrant(progress, { ...GRANT, grantId: 9n })).toBe(false);
  });
});
