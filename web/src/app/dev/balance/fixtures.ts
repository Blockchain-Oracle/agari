import { err, ok, stale, type Reading } from "@masayume/core/schemas";
import { diagnosis, type BalanceSheet } from "@masayume/core/types";
import type { BALANCE } from "@/lib/copy";

// Canned sheets carry their own decimals the way a chain read would; nothing here is a real balance.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
const STT = 10n ** 18n;
const AS_OF_MS = Date.UTC(2026, 8, 1, 10, 0, 0);
const STALE_AGE_MS = 90_000;
const FIXTURE_POOL = "0x0000000000000000000000000000000000000001" as const;

export const FIXTURE_SYMBOL = "tUSDC";

export type BalanceFixtureKey = Exclude<keyof typeof BALANCE.fixtures, "live">;

export interface BalanceFixture {
  key: BalanceFixtureKey;
  reading: Reading<BalanceSheet> | null;
}

function sheet(partial: Partial<BalanceSheet>): BalanceSheet {
  return {
    decimals: DECIMALS,
    spendableBase: 0n,
    nativeWei: 0n,
    orderEscrowBase: 0n,
    venueCreditBase: 0n,
    venueCreditByPool: [],
    vaultBase: null,
    ...partial,
  };
}

const funded = sheet({ spendableBase: 1_234n * UNIT + 560_000n, nativeWei: 2n * STT });
const pooled = sheet({
  spendableBase: 480n * UNIT + 250_000n,
  nativeWei: STT / 4n,
  orderEscrowBase: 75n * UNIT,
  venueCreditBase: 12n * UNIT + 500_000n,
  venueCreditByPool: [{ pool: FIXTURE_POOL, amountBase: 12n * UNIT + 500_000n }],
});

export const BALANCE_FIXTURES: readonly BalanceFixture[] = [
  { key: "zero", reading: ok(sheet({}), AS_OF_MS) },
  { key: "funded", reading: ok(funded, AS_OF_MS) },
  { key: "pools", reading: ok(pooled, AS_OF_MS) },
  { key: "stale", reading: stale(ok(pooled, AS_OF_MS - STALE_AGE_MS), "refresh-failed") },
  { key: "error", reading: err(diagnosis("rpc-down", "fixture: the first balance read never answered")) },
  { key: "loading", reading: null },
];
