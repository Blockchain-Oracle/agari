import { describe, expect, it } from "vitest";
import { findBannedWords, findHardBannedWords, findStyleWords } from "./banned-words";
import { deskCopy } from "./copy";
import type { DeskMarketRead } from "./market";
import { pregate, BLOCKER_RULES } from "./pregate";
import { buildEvidence, DESK_TIMING_SYSTEM_PROMPT, ownerRules } from "./prompt";
import { deskApprovalText, deskCheckNowText, deskMandateText } from "./signed";

/** Every string a copy tree can produce, with sample arguments for the functions. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (typeof node === "function") out.push(String((node as (...a: unknown[]) => unknown)(["OpenAI", "Anthropic"], 1234, 5678, 910, "x")));
  else if (node && typeof node === "object") for (const v of Object.values(node)) strings(v, out);
  return out;
}

describe("our own words", () => {
  it("no copy line uses a banned word", () => {
    for (const text of strings(deskCopy)) expect(findBannedWords(text), text).toEqual([]);
  });

  it("the prompt names what it must and never a name we are not", () => {
    expect(findHardBannedWords(DESK_TIMING_SYSTEM_PROMPT.replace(/^- (Never write|Say "PreStocks token").*$/gm, ""))).toEqual([]);
    expect(DESK_TIMING_SYSTEM_PROMPT).toContain("PreStocks token");
    expect(DESK_TIMING_SYSTEM_PROMPT).toContain("above its mark");
    expect(DESK_TIMING_SYSTEM_PROMPT).toContain("1 percent fee");
    expect(DESK_TIMING_SYSTEM_PROMPT).not.toMatch(/robinhood|shijima|chainlink|uniswap/i);
  });

  it("the signed texts say what they allow and name the network", () => {
    const mandate = deskMandateText({ owner: "OWNER", cluster: "mainnet-beta", version: 2, fingerprint: `0x${"ab".repeat(32)}`, signedAtIso: "2026-09-22T14:00:00Z" });
    expect(mandate).toContain("does not approve any single trade");
    expect(mandate).toContain("Network: Solana mainnet");
    const approval = deskApprovalText({ owner: "OWNER", cluster: "mainnet-beta", decisionSeq: 7, decisionHash: `0x${"cd".repeat(32)}`, answer: "approve", summary: "buy $140 of OpenAI", expiresAtIso: "2026-09-22T17:00:00Z" });
    expect(approval).toContain("I approve this one action: buy $140 of OpenAI.");
    expect(approval).toContain("Decision: 7");
    expect(deskCheckNowText({ owner: "OWNER", cluster: "devnet", requestedAtIso: "2026-09-22T14:00:00Z" })).toContain("Network: Solana devnet");
    for (const text of [mandate, approval]) expect(findBannedWords(text)).toEqual([]);
  });

  it("the word lists catch whole words only", () => {
    expect(findStyleWords("Alphabet reported; the alpha is gone")).toEqual(["alpha"]);
    expect(findStyleWords("moonshot is a game")).toEqual([]);
    expect(findHardBannedWords("shares of OpenAI")).toHaveLength(1);
    expect(findHardBannedWords("a share token")).toEqual([]);
    expect(findHardBannedWords("pre-IPO stocks")).toHaveLength(1);
    expect(findHardBannedWords("a pre-IPO name")).toEqual([]);
  });
});

const market = (over: Partial<DeskMarketRead> = {}): DeskMarketRead => ({
  atSec: 1_790_000_000, symbol: "OPENAI", spotE8: 115_518_656_774n, meanE8: 115_400_000_000n, markE8: 100_300_000_000n, indexE8: null, multiplierE12: 1_486_134_700_000n,
  referenceAgeSec: 30, gapBps: 10, inLine: true, movingBps: 10, premiumBps: 1517, indexPremiumBps: null, quoteOut: 29_000_000n, costBps: 130, routeAccounts: 14, mintPaused: false, accountFrozen: false, ...over,
});
const candidate = { id: "c1", side: "buy" as const, symbol: "OPENAI" as const, mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", amountIn: 50_000_000n, why: "drifted", protective: false };
const input = (m: DeskMarketRead, over = {}) => ({ candidate, market: m, deskActive: true, deskStateText: "active", onChain: { configured: true, enabled: true }, premiumBps: m.premiumBps, maxPremiumBps: 1000, beyondBand: false, repeatedWithinMinutes: false, ...over });

describe("the pre-gate names its rules", () => {
  it("blocks OpenAI above the ceiling and says the two numbers", () => {
    const blockers = pregate(input(market()));
    expect(blockers.map((b) => b.rule)).toEqual(["PREMIUM_TOO_HIGH"]);
    expect(blockers[0]!.text).toBe("OpenAI is 15.2% above its mark. Your ceiling is 10.0%.");
  });

  it("every rule can fire, each once, in the program's order", () => {
    const all = pregate(input(market({ referenceAgeSec: 901, quoteOut: null, movingBps: 150, mintPaused: null, accountFrozen: null, routeAccounts: 21 }), { deskActive: false, deskStateText: "paused by you", onChain: { configured: false, enabled: false }, beyondBand: true, repeatedWithinMinutes: true }));
    expect(all.map((b) => b.rule)).toEqual(["DESK_NOT_ACTIVE", "TOKEN_NOT_ALLOWED", "REFERENCE_UNAVAILABLE", "PREMIUM_TOO_HIGH", "QUOTE_UNAVAILABLE", "BEYOND_PRICE_BAND", "PRICE_MOVING_FAST", "MINT_PAUSED", "ACCOUNT_FROZEN", "ROUTE_TOO_LARGE", "DID_THIS_MINUTES_AGO"]);
    expect(BLOCKER_RULES).toHaveLength(11);
  });

  it("a sell of a disallowed name is not blocked by the allow list or the premium", () => {
    const sell = pregate(input(market(), { candidate: { ...candidate, side: "sell" }, onChain: { configured: true, enabled: false } }));
    expect(sell).toEqual([]);
  });
});

describe("evidence", () => {
  it("numbers e1..e7, the model may cite only those, and rules come from the notes by line", () => {
    const rules = ownerRules("- Never buy on a Sunday.\n\n2) Keep it small.\n");
    expect(rules).toEqual([{ id: "r1", text: "Never buy on a Sunday." }, { id: "r2", text: "Keep it small." }]);
    const pack = buildEvidence(candidate, market(), { perActionCapE6: 50_000_000n, remainingTodayE6: 150_000_000n, cashE6: 1_000_000_000n, tokenBalanceRaw: 0n, paused: false, referenceFresh: true }, { result: "allow", reasons: [], countedE6: 50_000_000n, oracleValueE6: 0n, oracleFloor: 26_794_615n, minOut: 28_855_000n, premiumOk: false }, {
      mandateLine: "MANDATE: 40.0% OpenAI · 40.0% Anthropic · 20.0% cash.",
      rules,
      trigger: "hourly",
      nextCheckIso: "2026-09-22T15:00:00.000Z",
      position: { weightBps: 0, targetBps: 4000, driftBps: -4000, thresholdBps: 550 },
      recent: { lastOnThisNameIso: null, lastOutcome: null, minutesSince: null, standingWait: null },
    });
    expect(pack.evidenceIds).toEqual(["e1", "e2", "e3", "e4", "e5", "e6", "e7"]);
    expect(pack.ruleIds).toEqual(["r1", "r2"]);
    expect(pack.userMessage).toContain("15.2% above its mark");
    expect(pack.userMessage).toContain('r1 "Never buy on a Sunday."');
    expect(pack.userMessage).not.toMatch(/robinhood|shijima/i);
    expect(findBannedWords(pack.userMessage)).toEqual([]);
  });
});
