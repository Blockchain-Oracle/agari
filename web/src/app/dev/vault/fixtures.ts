import { err, ok, stale, type Reading } from "@masayume/core/schemas";
import { diagnosis, toMarketId, type Address } from "@masayume/core/types";
import type { VaultDeployment, VaultGrant, VaultSnapshot } from "@masayume/core/vault";
import type { VAULT } from "@/features/vault";
import type { VaultOpenBet } from "@/features/vault";

// Canned readings; nothing here is a real balance, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
const AS_OF_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const STALE_AGE_MS = 90_000;
const NOW_SEC = Math.floor(AS_OF_MS / 1000);

export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_OWNER = "0x000000000000000000000000000000000000d357" as Address;

const deployment: VaultDeployment = {
  chainId: 50312,
  eventVault: "0x00000000000000000000000000000000000000e7" as Address,
  forwarder: "0x00000000000000000000000000000000000000f0" as Address,
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as Address,
  fromBlock: 477_650_000n,
};

function grant(id: bigint, kind: VaultGrant["kind"], budget: bigint): VaultGrant {
  return {
    grantId: id,
    owner: FIXTURE_OWNER,
    actor: `0x00000000000000000000000000000000000000a${id.toString()}` as Address,
    kind,
    revoked: false,
    expiresAtSec: NOW_SEC + 86_400,
    spentDay: Math.floor(NOW_SEC / 86_400),
    spentTodayBase: 12n * UNIT,
    openPositions: 1,
    caps: { maxStakePerTradeBase: 25n * UNIT, maxDailySpendBase: 100n * UNIT, maxOpenPositions: 4, maxPriceRaw: 0n },
    budgetBase: budget,
  };
}

function snapshot(over: Partial<VaultSnapshot["account"]>, grants: Partial<VaultSnapshot["grants"]> = {}): VaultSnapshot {
  return {
    deployment,
    account: { availableBase: 0n, privateAvailableBase: 0n, totalDepositedBase: 0n, totalWithdrawnBase: 0n, ...over },
    grants: { session: null, executor: null, strategy: null, ...grants },
    decimals: DECIMALS,
  };
}

const funded = snapshot({ availableBase: 240n * UNIT + 500_000n, privateAvailableBase: 18n * UNIT, totalDepositedBase: 300n * UNIT, totalWithdrawnBase: 41n * UNIT + 500_000n });
const withGrants = snapshot(
  { availableBase: 90n * UNIT, privateAvailableBase: 0n, totalDepositedBase: 300n * UNIT, totalWithdrawnBase: 0n },
  { session: grant(1n, "session", 50n * UNIT), strategy: grant(2n, "strategy", 160n * UNIT) },
);

export type VaultFixtureKey = Exclude<keyof typeof VAULT.fixtures, "live" | "bets">;

export interface VaultFixture {
  key: VaultFixtureKey;
  reading: Reading<VaultSnapshot | null> | null;
  busy: "vault-deposit" | null;
}

export const VAULT_FIXTURES: readonly VaultFixture[] = [
  { key: "notDeployed", reading: ok(null, AS_OF_MS), busy: null },
  { key: "empty", reading: ok(snapshot({}), AS_OF_MS), busy: null },
  { key: "funded", reading: ok(funded, AS_OF_MS), busy: null },
  { key: "grants", reading: ok(withGrants, AS_OF_MS), busy: null },
  { key: "busy", reading: ok(funded, AS_OF_MS), busy: "vault-deposit" },
  { key: "stale", reading: stale(ok(funded, AS_OF_MS - STALE_AGE_MS), "refresh-failed"), busy: null },
  { key: "error", reading: err(diagnosis("rpc-down", "fixture: the first vault read never answered")), busy: null },
  { key: "loading", reading: null, busy: null },
];

const id = (n: number) => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);

export const OPEN_BETS: VaultOpenBet[] = [
  { marketId: id(0x11019), asset: "BTC", intervalSec: 300, expirySec: NOW_SEC + 180, decimals: DECIMALS, heldUpRaw: 10n * UNIT, heldDownRaw: 0n, stakeBase: 4n * UNIT + 340_000n },
  { marketId: id(0x11020), asset: "ETH", intervalSec: 900, expirySec: NOW_SEC + 40, decimals: DECIMALS, heldUpRaw: 0n, heldDownRaw: 25n * UNIT, stakeBase: 14n * UNIT + 875_000n },
  { marketId: id(0x11021), asset: "BTC", intervalSec: 3_600, expirySec: NOW_SEC + 2_400, decimals: DECIMALS, heldUpRaw: 5n * UNIT, heldDownRaw: 5n * UNIT, stakeBase: 5n * UNIT },
];

export const WALLET_SPENDABLE = 1_234n * UNIT + 560_000n;
export const FIXTURE_NOW_MS = AS_OF_MS;
