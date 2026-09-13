import { describe, expect, it } from "vitest";
import { phase, type PhaseInput } from "./phase";
import { ONCHAIN_STATUS } from "./status";

const START_SEC = 1_000_000;
const INTERVAL_SEC = 300;
const EXPIRY_SEC = START_SEC + INTERVAL_SEC;
const HEADROOM_SEC = 30;

function market(overrides: Partial<PhaseInput> = {}): PhaseInput {
  return {
    tradingStartSec: START_SEC,
    expirySec: EXPIRY_SEC,
    intervalSec: INTERVAL_SEC,
    openingPriceRaw: 1n,
    status: "Trading",
    voided: false,
    finalized: null,
    ...overrides,
  };
}

const at = (sec: number) => sec * 1000;

describe("phase", () => {
  it("walks the time-derived transitions of one window", () => {
    expect(phase(market(), at(START_SEC - 1))).toBe("upcoming");
    expect(phase(market({ openingPriceRaw: null }), at(START_SEC))).toBe("pendingOpeningPrint");
    expect(phase(market(), at(START_SEC))).toBe("trading");
    expect(phase(market(), at(EXPIRY_SEC - HEADROOM_SEC - 1))).toBe("trading");
    expect(phase(market(), at(EXPIRY_SEC - HEADROOM_SEC))).toBe("noEntryBuffer");
    expect(phase(market(), at(EXPIRY_SEC))).toBe("locked");
  });

  it("derives settlement phases from indexed and on-chain status", () => {
    expect(phase(market({ status: "Resolved" }), at(EXPIRY_SEC + 5))).toBe("settledUnclaimed");
    expect(phase(market({ status: "Resolved", finalized: true }), at(EXPIRY_SEC + 5))).toBe("finalized");
    expect(phase(market({ status: "Finalized" }), at(EXPIRY_SEC + 5))).toBe("finalized");
    expect(phase(market({ status: "Voided", voided: true }), at(EXPIRY_SEC + 5))).toBe("voided");
    expect(phase(market({ onchainStatus: ONCHAIN_STATUS.Resolved }), at(START_SEC))).toBe("settledUnclaimed");
    expect(phase(market({ onchainStatus: ONCHAIN_STATUS.Voided }), at(START_SEC))).toBe("voided");
  });

  it("lets a head-fresh on-chain status override a lagging indexer row", () => {
    expect(phase(market({ status: "Trading", onchainStatus: ONCHAIN_STATUS.Locked }), at(START_SEC))).toBe("locked");
    expect(phase(market({ status: "Listed", onchainStatus: ONCHAIN_STATUS.Trading }), at(START_SEC))).toBe("trading");
    expect(phase(market({ status: "Trading", onchainStatus: ONCHAIN_STATUS.Listed }), at(START_SEC - 1))).toBe("upcoming");
  });
});
