import { txUrl } from "@agari/core/urls";
import { diagnosis, type ClaimableRow, type Signature } from "@agari/core/types";
import { IDLE_RUN, itemsFromRows } from "@/features/markets/claims";
import type { ClaimItem, ClaimRun } from "@/features/markets/claims";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

export const DECIMALS = 6;
export const FIXED_NOW_MS = Date.UTC(2026, 8, 1, 14, 35, 0);
const FIXED_NOW_SEC = FIXED_NOW_MS / 1000;

export const TX_HASHES: readonly Signature[] = [
  fixtureSignature("0x9f3b2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809"),
  fixtureSignature("0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f810"),
  fixtureSignature("0x2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a"),
];
export const SETTLEMENT_TX_URL = txUrl(TX_HASHES[2]!);
export const ORACLE_QUESTION_ID = "1842";
/** The print proof is the settling transaction until S5 adds each source's own proof (D-012). */
export const ORACLE_URL = SETTLEMENT_TX_URL;

const MARKET_ADDRESS = fixtureAddress("0x2f0b9c4d3e5a7f8190a1b2c3d4e5f60718293a4b");
const marketId = (suffix: string) => fixtureMarketId(`0x${suffix}`);

function row(overrides: Partial<ClaimableRow> & Pick<ClaimableRow, "kind" | "marketId" | "asset" | "intervalSec" | "legs">): ClaimableRow {
  const netPayoutBase = overrides.legs.reduce((sum, leg) => sum + leg.payoutBase, 0n);
  return {
    marketAddress: MARKET_ADDRESS,
    expirySec: FIXED_NOW_SEC - 600,
    netPayoutBase,
    feeBps: 0,
    decimals: DECIMALS,
    settledAtMs: null,
    ...overrides,
  };
}

/** A clean UP win: 200 contracts redeem for 200.00 net of a 0 bps fee. */
export const WIN_ROW = row({
  kind: "win",
  marketId: marketId("ff1b"),
  asset: "TSLA",
  intervalSec: 300,
  legs: [{ outcomeIdx: 0, amountRaw: 200_000_000n, payoutBase: 200_000_000n }],
  settledAtMs: FIXED_NOW_MS - 598_000,
});

/** A void: ONE row, both sides redeem at 0.5 gross — two legs, two states. */
export const VOID_ROW = row({
  kind: "void",
  marketId: marketId("ff0c"),
  asset: "NVDA",
  intervalSec: 900,
  expirySec: FIXED_NOW_SEC - 2_400,
  legs: [
    { outcomeIdx: 0, amountRaw: 40_000_000n, payoutBase: 20_000_000n },
    { outcomeIdx: 1, amountRaw: 60_000_000n, payoutBase: 30_000_000n },
  ],
});

export const LATER_WIN_ROW = row({
  kind: "win",
  marketId: marketId("fee9"),
  asset: "NVDA",
  intervalSec: 3_600,
  expirySec: FIXED_NOW_SEC - 7_200,
  legs: [{ outcomeIdx: 1, amountRaw: 75_500_000n, payoutBase: 75_500_000n }],
  settledAtMs: FIXED_NOW_MS - 7_198_000,
});

export const IDLE_ROWS: readonly ClaimableRow[] = [WIN_ROW, VOID_ROW];
export const BATCH_ROWS: readonly ClaimableRow[] = [WIN_ROW, VOID_ROW, LATER_WIN_ROW];

function withStatuses(items: ClaimItem[], patches: readonly Partial<ClaimItem>[]): ClaimItem[] {
  return items.map((item, i) => ({ ...item, ...patches[i] }));
}

/** "claiming 2 of 4": the first leg reverted (already paid), the second is signing, the rest wait. */
export const MID_RUN: ClaimRun = {
  ...IDLE_RUN,
  status: "running",
  items: withStatuses(itemsFromRows(BATCH_ROWS), [
    { status: "reverted", txHash: TX_HASHES[0], diagnosis: diagnosis("already-claimed", "ContractRevertError: NothingToRedeem()", { errorName: "NothingToRedeem" }) },
    { status: "claiming" },
    { status: "pending" },
    { status: "pending" },
  ]),
};

/** Every leg landed; the receipt reads back what the wallet actually received. */
export const DONE_RUN: ClaimRun = {
  ...IDLE_RUN,
  status: "done",
  finishedAtMs: FIXED_NOW_MS,
  items: withStatuses(itemsFromRows(BATCH_ROWS), [
    { status: "confirmed", txHash: TX_HASHES[0] },
    { status: "confirmed", txHash: TX_HASHES[1] },
    { status: "confirmed", txHash: TX_HASHES[1] },
    { status: "confirmed", txHash: TX_HASHES[2] },
  ]),
};
