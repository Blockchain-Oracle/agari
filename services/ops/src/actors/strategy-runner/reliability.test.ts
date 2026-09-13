import type { Address, EventMarket } from "@masayume/core/types";
import type { StrategySubscription } from "@masayume/core/strategies";
import type { SubmitterSession } from "@masayume/markets";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAttempt: vi.fn(), begin: vi.fn(), finish: vi.fn(), recordFill: vi.fn(), unresolved: vi.fn(), owners: vi.fn(), decisions: vi.fn(), fills: vi.fn(), snapshot: vi.fn(), onchain: vi.fn(), holdings: vi.fn(), quote: vi.fn(), recover: vi.fn(), tallies: vi.fn(), grant: vi.fn(), subscribers: vi.fn(), send: vi.fn(), settle: vi.fn(), market: vi.fn() }));
vi.mock("@masayume/db", () => ({ getStrategyAttempt: mocks.getAttempt, beginStrategyAttempt: mocks.begin, finishStrategyAttempt: mocks.finish, recordAttemptFill: mocks.recordFill, listUnresolvedStrategyAttempts: mocks.unresolved, listStrategyOwners: mocks.owners, listStrategyDecisions: mocks.decisions, listStrategyFills: mocks.fills }));
vi.mock("@masayume/markets", () => ({ marketsProvider: { getVaultSnapshot: mocks.snapshot, getOnchain: mocks.onchain, getVaultHoldings: mocks.holdings, freshQuoteStake: mocks.quote, getMarket: mocks.market, nowMs: () => 2_000_000 } }));
vi.mock("@masayume/markets/vault", () => ({ getVaultGrant: mocks.grant, listVaultTallies: mocks.tallies, recoverVaultExecution: mocks.recover }));
vi.mock("@masayume/markets/strategies", () => ({ listStrategySubscribers: mocks.subscribers }));

import { executeForSubscriber } from "./execute";
import { readAgentRecord, settlementReader } from "./agent-record";
import { reconcileRunnerAttempts, serialCycle, settleStrategyPositions } from "./lifecycle";

const OWNER = `0x${"11".repeat(20)}` as Address;
const RUNNER = `0x${"22".repeat(20)}` as Address;
const MARKET = `0x${"33".repeat(32)}`;
const HASH = `0x${"44".repeat(32)}`;
const ok = <T>(value: T) => ({ ok: true as const, value, stale: false, asOfMs: 0 });
const grant = { grantId: 9n, owner: OWNER, actor: RUNNER, kind: "strategy", revoked: false, expiresAtSec: 10_000, spentDay: 0, spentTodayBase: 0n, openPositions: 0, budgetBase: 5_000_000n, caps: { maxStakePerTradeBase: 1_000_000n, maxDailySpendBase: 5_000_000n, maxOpenPositions: 1, maxPriceRaw: 0n } };
const recordedFill = { txHash: HASH, strategyId: "1", grantId: "9", owner: OWNER, marketId: MARKET, side: "up", cashDelta: "100", tokenDelta: "200", atSec: 1_000, dryRun: false };
const session = { address: RUNNER, contracts: { publicClient: { getBlockNumber: async () => 123n, getTransactionCount: async () => 7 } }, submitter: { submitOrder: mocks.send, submitTx: mocks.settle } } as unknown as SubmitterSession;
const input = { session, sub: { strategyId: 1n, subscriber: OWNER, grantId: 9n } as StrategySubscription, market: { marketId: MARKET, asset: "BTC", decimals: 6, intervalSec: 900 } as EventMarket, decision: { side: "up" as const, moveBps: 20, thresholdBps: 10, reason: "trend" }, nowMs: 1_000_000, dryRun: false };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAttempt.mockResolvedValue(null);
  mocks.begin.mockResolvedValue(true);
  mocks.snapshot.mockResolvedValue(ok({ grants: { strategy: grant } }));
  mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, status: 1, expirySec: 3_000, isResolved: false, isVoided: false }));
  mocks.holdings.mockResolvedValue(ok({ upRaw: 0n, downRaw: 0n, upGrantId: 0n, downGrantId: 0n }));
  mocks.quote.mockResolvedValue(ok({}));
  mocks.owners.mockResolvedValue([]);
  mocks.subscribers.mockResolvedValue([]);
  mocks.fills.mockResolvedValue([recordedFill]);
});

describe("durable strategy attempts", () => {
  it("does not submit when another process already reserved the Window", async () => {
    mocks.begin.mockResolvedValue(false);
    expect((await executeForSubscriber(input)).status).toBe("skipped");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("holds when the attempt store or chain holdings cannot be read", async () => {
    mocks.getAttempt.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(executeForSubscriber(input)).rejects.toThrow("db unavailable");
    mocks.holdings.mockResolvedValue({ ok: false, error: {} });
    expect(await executeForSubscriber(input)).toMatchObject({ status: "skipped", reason: "holdings unreadable; holding" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("preserves an unknown send and refuses to replay it after restart", async () => {
    mocks.send.mockResolvedValue({ status: "unknown", txHash: HASH, diagnosis: { technical: "RPC timeout" } });
    expect((await executeForSubscriber(input)).status).toBe("unknown");
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ nonce: 7, fromBlock: "123" }));
    expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), "unknown", HASH, "RPC timeout");
    mocks.getAttempt.mockResolvedValue({ state: "unknown" });
    expect((await executeForSubscriber(input)).status).toBe("unknown");
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("commits actual fill deltas with the completed attempt", async () => {
    mocks.send.mockResolvedValue({ status: "confirmed", booked: { txHash: HASH, costBase: 920_000n, contractsRaw: 2_000_000n } });
    expect((await executeForSubscriber(input)).status).toBe("filled");
    expect(mocks.recordFill).toHaveBeenCalledWith(expect.objectContaining({ cashDelta: "920000", tokenDelta: "2000000", grantId: "9" }));
  });
  it("does not reserve or submit against stale grant, chain, holdings or quote fallbacks", async () => {
    for (const [read, value] of [[mocks.snapshot, { grants: { strategy: grant } }], [mocks.onchain, { marketId: MARKET }], [mocks.holdings, { upRaw: 0n, downRaw: 0n }], [mocks.quote, {}]] as const) {
      read.mockResolvedValueOnce({ ...ok(value), stale: true });
      expect((await executeForSubscriber(input)).status).toBe("skipped");
    }
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("recovery and settlement", () => {
  it("keeps ambiguous evidence held even after the Window expires", async () => {
    mocks.unresolved.mockResolvedValue([{ strategyId: "1", owner: OWNER, runner: RUNNER, marketId: MARKET, grantId: "9", side: "up", fromBlock: "123", nonce: 7, txHash: null }]);
    mocks.recover.mockResolvedValue({ status: "unknown" });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, status: 4, expirySec: 1, isResolved: true, isVoided: false }));
    expect(await reconcileRunnerAttempts(session, () => undefined)).toEqual(new Set(["1"]));
    expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), "unknown", null, "confirmation unknown; not resending");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("recovers a matching fill without sending another order", async () => {
    mocks.unresolved.mockResolvedValue([{ strategyId: "1", owner: OWNER, runner: RUNNER, marketId: MARKET, grantId: "9", side: "up", fromBlock: "123", nonce: 7, txHash: HASH }]);
    mocks.recover.mockResolvedValue({ status: "confirmed", txHash: HASH, cashDelta: 920n, tokenDelta: 2_000n, atSec: 1_500, side: "up" });
    expect(await reconcileRunnerAttempts(session, () => undefined)).toEqual(new Set());
    expect(mocks.recordFill).toHaveBeenCalledWith(expect.objectContaining({ cashDelta: "920", atSec: 1_500 }));
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("settles a former subscriber's revoked grant into availability, never re-funds the grant", async () => {
    mocks.owners.mockResolvedValue([OWNER]);
    mocks.tallies.mockResolvedValue({ complete: true, tallies: [{ marketId: MARKET, settledAtSec: 0 }] });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, status: 4, isResolved: true, isVoided: false }));
    mocks.holdings.mockResolvedValueOnce(ok({ upRaw: 200n, downRaw: 0n, upGrantId: 9n, downGrantId: 0n })).mockResolvedValueOnce(ok({ upRaw: 0n, downRaw: 0n }));
    mocks.grant.mockResolvedValue({ ...grant, revoked: true });
    mocks.settle.mockResolvedValue({ status: "confirmed", txHash: HASH });
    expect(await settleStrategyPositions(session, 1n, false, () => undefined)).toBe(1);
    expect(mocks.tallies).toHaveBeenCalledWith(OWNER, { complete: true });
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith({ kind: "vault-crank-settle", owner: OWNER, marketId: MARKET });
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ strategyId: "1", grantId: "9", kind: "settle" }));
  });
  it("attributes a shared owner's settlement to the position's strategy, not the discovering cycle", async () => {
    mocks.owners.mockResolvedValue([OWNER]);
    mocks.tallies.mockResolvedValue({ complete: true, tallies: [{ marketId: MARKET, settledAtSec: 0 }] });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, isResolved: true, isVoided: false }));
    mocks.holdings.mockResolvedValueOnce(ok({ upRaw: 200n, downRaw: 0n, upGrantId: 9n, downGrantId: 0n })).mockResolvedValueOnce(ok({ upRaw: 0n, downRaw: 0n }));
    mocks.grant.mockResolvedValue(grant);
    mocks.fills.mockResolvedValue([{ ...recordedFill, strategyId: "2" }]);
    mocks.settle.mockResolvedValue({ status: "confirmed", txHash: HASH });
    const log = vi.fn();
    expect(await settleStrategyPositions(session, 1n, false, log)).toBe(1);
    expect(mocks.getAttempt).toHaveBeenCalledWith(expect.objectContaining({ strategyId: "2", kind: "settle" }));
    expect(mocks.begin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ strategyId: "2", grantId: "9", kind: "settle" }));
    expect(mocks.finish).toHaveBeenCalledWith(expect.objectContaining({ strategyId: "2" }), "settled", HASH, "settlement receipt confirmed");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("#2: settled"));
  });
  it("holds unknown provenance instead of borrowing a different owner, market, grant, side or dry-run fill", async () => {
    mocks.owners.mockResolvedValue([OWNER]);
    mocks.tallies.mockResolvedValue({ complete: true, tallies: [{ marketId: MARKET, settledAtSec: 0 }] });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, isResolved: true, isVoided: false }));
    mocks.holdings.mockResolvedValue(ok({ upRaw: 200n, downRaw: 0n, upGrantId: 9n, downGrantId: 0n }));
    mocks.grant.mockResolvedValue(grant);
    for (const rows of [null, [], ...[{ owner: RUNNER }, { marketId: HASH }, { grantId: "8" }, { side: "down" }, { dryRun: true }, { tokenDelta: "0" }].map((mismatch) => [{ ...recordedFill, ...mismatch }])]) {
      mocks.fills.mockResolvedValue(rows);
      await expect(settleStrategyPositions(session, 1n, false, () => undefined)).rejects.toThrow("settlement strategy attribution unknown");
    }
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("holds conflicting origins when one settlement would burn positions from two strategies", async () => {
    mocks.owners.mockResolvedValue([OWNER]);
    mocks.tallies.mockResolvedValue({ complete: true, tallies: [{ marketId: MARKET, settledAtSec: 0 }] });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, isResolved: true, isVoided: false }));
    mocks.holdings.mockResolvedValue(ok({ upRaw: 200n, downRaw: 300n, upGrantId: 9n, downGrantId: 10n }));
    mocks.grant.mockResolvedValue(grant);
    mocks.fills.mockResolvedValue([recordedFill, { ...recordedFill, strategyId: "2", grantId: "10", side: "down", tokenDelta: "300" }]);
    await expect(settleStrategyPositions(session, 1n, false, () => undefined)).rejects.toThrow("settlement strategy attribution unknown");
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("does not settle a Locked Window or another grant kind", async () => {
    mocks.owners.mockResolvedValue([OWNER]);
    mocks.tallies.mockResolvedValue({ complete: true, tallies: [{ marketId: MARKET, settledAtSec: 0 }] });
    mocks.onchain.mockResolvedValue(ok({ marketId: MARKET, status: 2, isResolved: false, isVoided: false }));
    expect(await settleStrategyPositions(session, 1n, false, () => undefined)).toBe(0);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("does not clear an unknown settlement from stale zero holdings", async () => {
    mocks.unresolved.mockResolvedValue([{ kind: "settle", strategyId: "1", owner: OWNER, runner: RUNNER, marketId: MARKET, txHash: null }]);
    mocks.holdings.mockResolvedValue({ ...ok({ upRaw: 0n, downRaw: 0n }), stale: true });
    expect(await reconcileRunnerAttempts(session, () => undefined)).toEqual(new Set(["1"]));
    expect(mocks.finish).not.toHaveBeenCalledWith(expect.anything(), "settled", expect.anything(), expect.anything());
  });
});

describe("risk memory and scheduling", () => {
  it("refuses missing risk memory instead of assuming zero losses", async () => {
    mocks.decisions.mockResolvedValue(null);
    mocks.fills.mockResolvedValue([]);
    await expect(readAgentRecord(1n, 1_000, false, async () => null)).rejects.toThrow("risk memory unavailable");
  });
  it("does not score a stale pre-settlement market as an open Window with zero loss", async () => {
    mocks.decisions.mockResolvedValue([{ marketId: MARKET, side: "up", why: "trend", decidedAtMs: 1_000_000 }]);
    mocks.fills.mockResolvedValue([{ owner: OWNER, marketId: MARKET, side: "up", atSec: 1_000, cashDelta: "100" }]);
    mocks.market.mockResolvedValue({ ...ok({ status: "Trading", winningOutcome: null, resolvedAtMs: null }), stale: true });
    await expect(readAgentRecord(1n, 100_000, false, settlementReader())).rejects.toThrow("settlement facts missing");
  });
  it("starts loss cooldown and daily loss accounting at settlement, including older entries", async () => {
    mocks.decisions.mockResolvedValue([{ marketId: MARKET, side: "up", why: "trend", decidedAtMs: 1_000_000 }]);
    mocks.fills.mockResolvedValue([{ owner: OWNER, marketId: MARKET, side: "up", atSec: 1_000, cashDelta: "100" }]);
    const record = await readAgentRecord(1n, 100_000, false, async () => ({ settled: true, voided: false, winningOutcome: 1, resolvedAtSec: 99_000 }));
    expect(record).toMatchObject({ consecutiveLosses: 1, lastLossAtSec: 99_000, lostTodayBase: 100n });
  });
  it("allows only one slow cycle and releases the guard after a failure", async () => {
    let finish!: () => void;
    const tick = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined);
    const errors = vi.fn();
    const run = serialCycle(tick, errors);
    const first = run();
    await run();
    expect(tick).toHaveBeenCalledTimes(1);
    finish(); await first; await run(); await run();
    expect(tick).toHaveBeenCalledTimes(3);
    expect(errors).toHaveBeenCalledTimes(1);
  });
});
