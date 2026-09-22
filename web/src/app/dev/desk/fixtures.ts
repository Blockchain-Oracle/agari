/**
 * Canned desk views for `/dev/desk` (S21, plan §5.11): every state the page can show, from fixtures, with no wallet,
 * no index and no mainnet. The wire shapes are the routes' own (`protocol.ts`), so a fixture renders exactly as a
 * live read would.
 */
import { DEFAULT_LIMITS, DEFAULT_MONEY, mandateToWire, presetMandate } from "@agari/core/desk";
import { ok, type Reading } from "@agari/core/schemas";
import { DESK_MINTS, type OwnerDeskBalances } from "@agari/markets/desk";
import type { ApprovalWire, DeskRowWire, DeskViewWire, SnapshotWire } from "@/features/desk/protocol";
import type { DeskActions, StudioActions } from "@/features/desk/useDeskWrites";
import { fixtureAddress } from "../fixture-ids";
import { DESK_ADDRESS, DESK_ID, MANDATE_FINGERPRINT, NOW_SEC, OPERATOR, OWNER, RECORDS } from "./fixtures-records";

export { NOW_SEC, OWNER };

const MANDATE = presetMandate("ailabs", { notes: "Never buy on a Sunday." })!;

const row = (over: Partial<DeskRowWire> = {}): DeskRowWire => ({
  id: DESK_ID, address: null, owner: OWNER, cluster: "mainnet-beta", mode: "practice", state: "practice", stateReason: null, chainSeq: 0, chainHead: `0x${"0".repeat(64)}`, mandateVersion: 1,
  practiceChecks: 4, recordOpenedAtSec: null, sharePublic: false, createdAtSec: NOW_SEC - 86_400 * 2, updatedAtSec: NOW_SEC - 1_400, ...over,
});

const SNAPSHOT: SnapshotWire = {
  atSec: NOW_SEC - 1_400,
  totalE6: "1004200000",
  cashE6: "212400000",
  baselineE6: "1000000000",
  holdings: [
    { symbol: "OPENAI", raw: "2826000000", valueE6: "485170000", weightBps: 4831, targetBps: 4000, driftBps: 831, premiumBps: 1512, priceE8: "11551865677", priceAgeSec: 41, paused: false, frozen: false },
    { symbol: "ANTHROPIC", raw: "2930000000", valueE6: "306600000", weightBps: 3053, targetBps: 4000, driftBps: -947, premiumBps: 269, priceE8: "10464276840", priceAgeSec: 41, paused: false, frozen: false },
  ],
};

const OPEN_APPROVAL: ApprovalWire = { id: "apr-open", decisionSeq: 12, decisionHash: RECORDS[0]!.summary.recordHash, summary: "buy $50 of Anthropic", reason: "ask_first", side: "buy", symbol: "ANTHROPIC", amountIn: "50", expectedOut: "0.4718", confidencePercent: 71, costBps: 130, turnedDown: "Wait: nothing measurable is expected to change before the next check.", expiresAtSec: NOW_SEC + 2_200, status: "open", answeredAtSec: null, executionSeq: null };
const EXPIRED_APPROVAL: ApprovalWire = { ...OPEN_APPROVAL, id: "apr-expired", decisionSeq: 9, summary: "buy $140 of OpenAI", symbol: "OPENAI", amountIn: "140", expectedOut: "1.2119", reason: "large_action", expiresAtSec: NOW_SEC - 7_200, status: "expired" };

const base = (over: Partial<DeskViewWire> = {}): DeskViewWire => ({
  configured: true, viewer: "owner", desk: row(), mandate: { version: 1, body: mandateToWire(MANDATE), fingerprint: MANDATE_FINGERPRINT, appliedAtSec: NOW_SEC - 86_400 * 2 },
  snapshot: SNAPSHOT, paper: { cashE6: "212400000", positions: { OPENAI: "2826000000", ANTHROPIC: "2930000000" } }, approvals: [], latest: RECORDS[0]!.summary, recent: RECORDS.map((r) => r.summary),
  timing: { bps: 140, graded: 3 }, chain: null, chainError: null, operator: OPERATOR, nowSec: NOW_SEC, ...over,
});

const LIVE_ROW = row({ address: DESK_ADDRESS, mode: "ask_first", state: "active", practiceChecks: 9, recordOpenedAtSec: NOW_SEC - 86_400, chainSeq: 12, chainHead: `0x${"7b".repeat(32)}`, sharePublic: true });
const CHAIN: DeskViewWire["chain"] = {
  address: DESK_ADDRESS, operator: OPERATOR, seq: "12", head: `0x${"7b".repeat(32)}`, perActionCapE6: DEFAULT_MONEY.perActionCapE6.toString(), dailyCapE6: DEFAULT_MONEY.dailyCapE6.toString(), spentInWindowE6: "50000000", remainingDailyCapE6: "100000000",
  maxPremiumBps: DEFAULT_LIMITS.maxPremiumBps, mode: "ask_first", paused: false, usdcRaw: "212400000",
  tokens: [{ symbol: "OPENAI", mint: DESK_MINTS.OPENAI, raw: "2826000000", enabled: true, frozen: false, exists: true }, { symbol: "ANTHROPIC", mint: DESK_MINTS.ANTHROPIC, raw: "2930000000", enabled: true, frozen: false, exists: true }],
  slot: "300000000",
};
const liveRecords = RECORDS.map((r) => ({ ...r.summary, mode: "ask_first" as const, sealedBySig: null, sealedSeq: null }));

export const VIEWS = {
  /** Practice, 4 of 6 checks done, the record not opened: Go live locked. */
  practice: base(),
  /** Live on mainnet, asking first, with a waiting approval and one that expired unanswered. */
  live: base({ desk: LIVE_ROW, chain: CHAIN, approvals: [OPEN_APPROVAL, EXPIRED_APPROVAL], latest: liveRecords[0]!, recent: liveRecords, paper: null }),
  paused: base({ desk: { ...LIVE_ROW, state: "paused_by_owner" }, chain: { ...CHAIN, paused: true }, latest: liveRecords[0]!, recent: liveRecords, paper: null }),
  stopped: base({ desk: { ...LIVE_ROW, state: "stopped_by_loss_limit", stateReason: "The desk is worth $846.10, which is 15.4% below its baseline of $1,000.00. Your loss limit is 15.0%." }, chain: { ...CHAIN, paused: true }, snapshot: { ...SNAPSHOT, totalE6: "846100000" }, latest: liveRecords[0]!, recent: liveRecords, paper: null }),
  late: base({ desk: LIVE_ROW, chain: CHAIN, latest: { ...liveRecords[0]!, decidedAtSec: NOW_SEC - 3 * 3_600 - 900 }, recent: liveRecords, paper: null }),
  /** A frozen name: the issuer froze the desk's Anthropic account, and OpenAI sits above the premium ceiling. */
  frozen: base({
    desk: LIVE_ROW, chain: { ...CHAIN, tokens: CHAIN.tokens.map((t) => (t.symbol === "ANTHROPIC" ? { ...t, frozen: true } : t)) },
    snapshot: { ...SNAPSHOT, holdings: SNAPSHOT.holdings.map((h) => (h.symbol === "ANTHROPIC" ? { ...h, frozen: true } : { ...h, priceAgeSec: 1_300 })) }, latest: liveRecords[0]!, recent: liveRecords, paper: null,
  }),
  /** Someone else's desk, shared: the same page read-only, notes stripped. */
  shared: base({ viewer: "visitor", desk: LIVE_ROW, chain: CHAIN, mandate: { version: 1, body: { ...mandateToWire(MANDATE), notes: "" }, fingerprint: MANDATE_FINGERPRINT, appliedAtSec: NOW_SEC - 86_400 * 2 }, latest: liveRecords[0]!, recent: liveRecords, paper: null, operator: null }),
} as const;

/** The owner's wallet on mainnet for the money sheet: 0.02 SOL, $812.50 USDC, 4.2 OpenAI (raw × 1.4861347). */
export const BALANCES: Reading<OwnerDeskBalances> = ok(
  {
    lamports: 20_000_000n,
    usdc: { ownerToken: fixtureAddress("0x11") as unknown as OwnerDeskBalances["usdc"]["ownerToken"], raw: 812_500_000n },
    names: [
      { symbol: "OPENAI", mint: DESK_MINTS.OPENAI, ownerToken: fixtureAddress("0x12") as unknown as OwnerDeskBalances["usdc"]["ownerToken"], raw: 2_826_125_000n, multiplierE12: 1_486_134_700_000n, paused: false },
      { symbol: "ANTHROPIC", mint: DESK_MINTS.ANTHROPIC, ownerToken: fixtureAddress("0x13") as unknown as OwnerDeskBalances["usdc"]["ownerToken"], raw: 0n, multiplierE12: 1_000_000_000_000n, paused: false },
    ],
    slot: 300_000_000n,
  },
  NOW_SEC * 1000,
);

const IDLE = { busy: null, phase: "idle", signature: null, problem: null } as const;
const done = async () => ({ ok: true as const, signature: null, body: {} });

/** Writes that sign and send nothing: a card confirms, a phase never leaves idle, and the fixture says why. */
export function fixtureActions(): DeskActions & StudioActions {
  return {
    state: IDLE,
    owner: OWNER,
    mainnet: { kind: "no-wallet" },
    session: null,
    answer: done,
    checkNow: done,
    share: done,
    recordMode: done,
    requestAction: done,
    signMandate: done,
    tx: async () => ({ ok: false as const, reason: "Fixtures send nothing to Solana.", status: null }),
    reset: () => undefined,
  };
}
