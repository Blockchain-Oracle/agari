import { encodeBase58, toAddress, toMarketId } from "@agari/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  hasBet: vi.fn(),
  hasBetOnSymbol: vi.fn(),
  hasIndexedBet: vi.fn(),
  hasIndexedBetOnSymbol: vi.fn(),
  indexedWindowState: vi.fn(),
}));
const provider = vi.hoisted(() => ({ getOnchain: vi.fn(), getHoldings: vi.fn() }));

vi.mock("@agari/db", () => db);
vi.mock("@agari/markets", () => ({ ensureMarkets: () => undefined, marketsProvider: provider }));
vi.mock("@/lib/env", () => ({ webEnv: { markets: { chainId: 103 } } }));
vi.mock("@/lib/auth/verify-signed-message.server", () => ({ verifyWalletMessage: async () => true }));

const { admittingStep, GateUnreadableError, mintToken, readToken } = await import("./gate.server");

const filled = (n: number) => encodeBase58(new Uint8Array(32).fill(n));
const WALLET = toAddress(filled(0xd3));
const MARKET = toMarketId(filled(0x45));
const SEAT = { ok: true, value: { upRaw: 0n, downRaw: 250n } };

describe("room gate order (social-assistant.md §1.2)", () => {
  beforeEach(() => {
    for (const fn of [...Object.values(db), ...Object.values(provider)]) fn.mockReset();
    db.hasBet.mockResolvedValue(false);
    db.hasIndexedBet.mockResolvedValue(false);
    db.indexedWindowState.mockResolvedValue("live");
    provider.getOnchain.mockResolvedValue({ ok: true, value: { marketId: MARKET } });
    provider.getHoldings.mockResolvedValue({ ok: true, value: { upRaw: 0n, downRaw: 0n } });
  });

  it("admits on the first yes and never reads the chain when the registry or the index already said so", async () => {
    db.hasBet.mockResolvedValue(true);
    expect(await admittingStep(WALLET, MARKET)).toBe("registry");
    expect(db.hasIndexedBet).not.toHaveBeenCalled();

    db.hasBet.mockResolvedValue(false);
    db.hasIndexedBet.mockResolvedValue(true);
    expect(await admittingStep(WALLET, MARKET)).toBe("index");
    expect(provider.getOnchain).not.toHaveBeenCalled();
  });

  it("falls to the Ledger seat for a live Window, and skips the chain for one the index holds as past", async () => {
    provider.getHoldings.mockResolvedValue(SEAT);
    expect(await admittingStep(WALLET, MARKET)).toBe("seat");

    provider.getOnchain.mockClear();
    db.indexedWindowState.mockResolvedValue("past");
    expect(await admittingStep(WALLET, MARKET)).toBeNull();
    expect(provider.getOnchain).not.toHaveBeenCalled();
  });

  it("says unreadable, never no, when a step failed and none said yes — but a later yes still admits", async () => {
    db.hasIndexedBet.mockRejectedValue(new Error("db down"));
    await expect(admittingStep(WALLET, MARKET)).rejects.toBeInstanceOf(GateUnreadableError);

    provider.getHoldings.mockResolvedValue(SEAT);
    expect(await admittingStep(WALLET, MARKET)).toBe("seat");
  });

  it("gates a $TICKER Room on the ticker's registry and index only", async () => {
    db.hasBetOnSymbol.mockResolvedValue(false);
    db.hasIndexedBetOnSymbol.mockResolvedValue(false);
    provider.getHoldings.mockResolvedValue(SEAT);
    expect(await admittingStep(WALLET, "$TSLA")).toBeNull();
    expect(provider.getOnchain).not.toHaveBeenCalled();
    expect(db.hasIndexedBetOnSymbol).toHaveBeenCalledWith("TSLA", WALLET);

    db.hasIndexedBetOnSymbol.mockResolvedValue(true);
    expect(await admittingStep(WALLET, "$TSLA")).toBe("index");
  });

  it("binds a token to exactly one scope", () => {
    const token = mintToken(WALLET, "$TSLA", 1_000);
    expect(readToken(token, "$TSLA", 2_000)).toBe(WALLET);
    expect(readToken(token, MARKET, 2_000)).toBeNull();
    expect(readToken(token, "social", 2_000)).toBeNull();
    expect(readToken(token.replace("$TSLA", "$NVDA"), "$NVDA", 2_000)).toBeNull();
  });
});
