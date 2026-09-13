import type { RoundMarket } from "@masayume/core/projection";
import { toMarketId } from "@masayume/core/types";
import { describe, expect, it } from "vitest";
import { tallyToLedger, vaultRound, VAULT_TX_SENTINEL, type VaultTally } from "./history";

const ONE = 1_000_000n;
const marketId = toMarketId(`0x${"11009".padStart(64, "0")}`);

const tally = (over: Partial<VaultTally> = {}): VaultTally => ({
  marketId,
  costBase: 60n * ONE,
  proceedsBase: 0n,
  payoutBase: 0n,
  boughtUpRaw: 100n * ONE,
  boughtDownRaw: 0n,
  soldUpRaw: 0n,
  soldDownRaw: 0n,
  firstAtSec: 1_788_400_000,
  lastAtSec: 1_788_400_100,
  settledAtSec: 0,
  fillCount: 1,
  ...over,
});

const market = (over: Partial<RoundMarket> = {}): RoundMarket => ({
  marketId,
  asset: "BTC",
  intervalSec: 900,
  expirySec: 1_788_401_000,
  decimals: 6,
  settled: true,
  voided: false,
  winningOutcome: 0,
  resolvedAtMs: 1_788_401_005_000,
  ...over,
});

describe("the vault's tally as a ledger", () => {
  it("holds bought minus sold per side, with no transaction to link", () => {
    const ledger = tallyToLedger(tally({ soldUpRaw: 40n * ONE, proceedsBase: 24n * ONE, boughtDownRaw: 10n * ONE, fillCount: 3 }));
    expect(ledger.heldUpRaw).toBe(60n * ONE);
    expect(ledger.heldDownRaw).toBe(10n * ONE);
    expect(ledger.sidesTraded).toEqual([0, 1]);
    expect(ledger.entryTxHash).toBe(VAULT_TX_SENTINEL);
    expect(ledger.source).toBe("vault");
    expect(ledger.shortCount).toBe(0);
  });
});

describe("a settled vault round", () => {
  it("is to-collect until cranked, then paid into the Trading Balance", () => {
    const pending = vaultRound(tally(), market(), 0);
    expect(pending?.source).toBe("vault");
    expect(pending?.outcome).toBe("win");
    expect(pending?.payoutBase).toBe(100n * ONE);
    expect(pending?.pnlBase).toBe(40n * ONE);
    expect(pending?.claim).toBe("to-collect");

    const cranked = vaultRound(tally({ settledAtSec: 1_788_401_010, payoutBase: 100n * ONE }), market(), 0);
    expect(cranked?.claim).toBe("paid");
  });

  it("books a losing side at zero and a void at half", () => {
    const loss = vaultRound(tally(), market({ winningOutcome: 1 }), 0);
    expect(loss?.outcome).toBe("loss");
    expect(loss?.payoutBase).toBe(0n);
    expect(loss?.claim).toBe("none");

    const voided = vaultRound(tally(), market({ voided: true, winningOutcome: null }), 0);
    expect(voided?.outcome).toBe("void");
    expect(voided?.payoutBase).toBe(50n * ONE);
  });

  it("is null while the Window is open and when the tally is empty", () => {
    expect(vaultRound(tally(), market({ settled: false }), 0)).toBeNull();
    expect(vaultRound(tally({ boughtUpRaw: 0n, costBase: 0n, fillCount: 0 }), market(), 0)).toBeNull();
  });
});
