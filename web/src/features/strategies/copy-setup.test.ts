import { describe, expect, it, vi } from "vitest";
import type { VaultGrant } from "@masayume/core/vault";
import { completeCopySetup, type CopySetupInput, type CopySetupPorts } from "./copy-setup";
import type { CopyProgress } from "./copy-progress";

const RUNNER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"a".repeat(64)}` as const;
const CAPS = { maxStakePerTradeBase: 1n, maxDailySpendBase: 5n, maxOpenPositions: 1, maxPriceRaw: 850_000n };
const INPUT: CopySetupInput = { strategyId: 1n, runner: RUNNER, depositBase: 5n, budgetBase: 5n, caps: CAPS, feeBase: 2n };

function setup() {
  let saved: CopyProgress | null = null;
  let liveGrant: VaultGrant | null = null;
  const ports: CopySetupPorts = {
    load: () => saved,
    save: vi.fn((p: CopyProgress | null) => { saved = p; }),
    strategy: vi.fn(async () => ({ active: true, runner: RUNNER, feeBase: 2n })),
    grant: vi.fn(async () => ({ current: liveGrant })),
    createGrant: vi.fn(async (expiresAtSec: number) => {
      expect(saved?.stage).toBe("grant-pending");
      liveGrant = { grantId: 8n, owner: RUNNER, actor: RUNNER, kind: "strategy", revoked: false, expiresAtSec, spentDay: 0, spentTodayBase: 0n, openPositions: 0, caps: CAPS, budgetBase: 5n };
      return { ok: true, txHash: TX };
    }),
    subscribed: vi.fn(async () => false),
    receipt: vi.fn(async () => null),
    subscribe: vi.fn(async () => { expect(saved?.stage).toBe("subscribe-pending"); return { ok: true, txHash: TX }; }),
    nowSec: 100,
  };
  return { ports, saved: () => saved, grant: () => liveGrant };
}

describe("copy setup recovery and fee consent", () => {
  it("saves each step before signing and clears only after confirmed subscription", async () => {
    const { ports, saved } = setup();
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: true, stage: "subscribe" });
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
    expect(ports.subscribe).toHaveBeenCalledWith(8n);
    expect(saved()).toBeNull();
  });
  it("resumes a rejected second step without another deposit or permission", async () => {
    const { ports, saved } = setup();
    vi.mocked(ports.subscribe).mockResolvedValueOnce({ ok: false, reason: "Wallet rejected" });
    expect((await completeCopySetup(INPUT, ports)).ok).toBe(false);
    expect(saved()?.stage).toBe("subscribe-ready");
    expect((await completeCopySetup(INPUT, ports)).ok).toBe(true);
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
    expect(ports.subscribe).toHaveBeenCalledTimes(2);
  });
  it("never repeats an unknown subscription, even when no hash was returned", async () => {
    const { ports, saved } = setup();
    vi.mocked(ports.subscribe).mockResolvedValueOnce({ ok: false, unknown: true });
    await completeCopySetup(INPUT, ports);
    expect(saved()?.stage).toBe("subscribe-pending");
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, reason: expect.stringContaining("not been resent") });
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
    expect(ports.subscribe).toHaveBeenCalledTimes(1);
    vi.mocked(ports.subscribed).mockResolvedValue(true);
    expect((await completeCopySetup(INPUT, ports)).ok).toBe(true);
    expect(saved()).toBeNull();
  });
  it("retries only a provably reverted subscription receipt", async () => {
    const { ports } = setup();
    vi.mocked(ports.subscribe).mockResolvedValueOnce({ ok: false, unknown: true, txHash: TX });
    await completeCopySetup(INPUT, ports);
    vi.mocked(ports.receipt).mockResolvedValue("success");
    expect((await completeCopySetup(INPUT, ports)).ok).toBe(false);
    expect(ports.subscribe).toHaveBeenCalledTimes(1);
    vi.mocked(ports.receipt).mockResolvedValue("reverted");
    expect((await completeCopySetup(INPUT, ports)).ok).toBe(true);
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
    expect(ports.subscribe).toHaveBeenCalledTimes(2);
  });
  it("refuses a fee change before requesting any signature", async () => {
    const { ports } = setup();
    vi.mocked(ports.strategy).mockResolvedValue({ active: true, runner: RUNNER, feeBase: 3n });
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, reason: expect.stringContaining("fee changed") });
    expect(ports.createGrant).not.toHaveBeenCalled();
  });
  it("keeps the first step if the fee changes while permission confirms, then uses the newly reviewed fee", async () => {
    const { ports, saved } = setup();
    vi.mocked(ports.strategy).mockResolvedValueOnce({ active: true, runner: RUNNER, feeBase: 2n }).mockResolvedValue({ active: true, runner: RUNNER, feeBase: 3n });
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, stage: "subscribe" });
    expect(saved()?.stage).toBe("subscribe-ready");
    expect(ports.subscribe).not.toHaveBeenCalled();
    expect((await completeCopySetup({ ...INPUT, feeBase: 3n }, ports)).ok).toBe(true);
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
  });
  it("keeps an unknown grant and never deposits again while it is unobservable", async () => {
    const { ports, saved } = setup();
    vi.mocked(ports.createGrant).mockResolvedValue({ ok: false, unknown: true, txHash: TX });
    await completeCopySetup(INPUT, ports);
    expect(saved()?.grantTx).toBe(TX);
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, stage: "grant" });
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
    expect(ports.subscribe).not.toHaveBeenCalled();
  });
  it("does not mistake another current grant for its successful first step", async () => {
    const { ports, grant } = setup();
    vi.mocked(ports.subscribe).mockResolvedValueOnce({ ok: false });
    await completeCopySetup(INPUT, ports);
    vi.mocked(ports.grant).mockResolvedValue({ current: { ...grant()!, grantId: 9n } });
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, stage: "grant" });
    expect(ports.subscribe).toHaveBeenCalledTimes(1);
  });
  it("releases a definitively reverted permission without automatically repeating its deposit", async () => {
    const { ports, saved } = setup();
    vi.mocked(ports.createGrant).mockResolvedValue({ ok: false, unknown: true, txHash: TX });
    await completeCopySetup(INPUT, ports);
    vi.mocked(ports.receipt).mockResolvedValue("reverted");
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, reason: expect.stringContaining("deposit did not take effect") });
    expect(saved()).toBeNull();
    expect(ports.createGrant).toHaveBeenCalledTimes(1);
  });
  it("fails before signing if browser storage cannot preserve recovery", async () => {
    const { ports } = setup();
    ports.save = () => { throw new Error("Storage blocked"); };
    expect(await completeCopySetup(INPUT, ports)).toMatchObject({ ok: false, reason: "Storage blocked" });
    expect(ports.createGrant).not.toHaveBeenCalled();
  });
});
