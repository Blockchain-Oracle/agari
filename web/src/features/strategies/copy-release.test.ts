import { expect, it, vi } from "vitest";
import type { VaultGrant } from "@masayume/core/vault";
import { releaseCopyPermission } from "./copy-release";
import { completeCopySetup } from "./copy-setup";
import type { CopyProgress } from "./copy-progress";

const OWNER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"a".repeat(64)}` as const;
const CAPS = { maxStakePerTradeBase: 1n, maxDailySpendBase: 5n, maxOpenPositions: 1, maxPriceRaw: 0n };
const GRANT: VaultGrant = { grantId: 8n, owner: OWNER, actor: OWNER, kind: "strategy", revoked: false, expiresAtSec: 200, spentDay: 0, spentTodayBase: 0n, openPositions: 0, caps: CAPS, budgetBase: 5n };
const PROGRESS: CopyProgress = { strategyId: "1", runner: OWNER, stage: "subscribe-ready", previousGrantId: null, grantId: "8", grantTx: null, subscribeTx: null, budgetBase: "5", feeBase: "0", expiresAtSec: 200, caps: { maxStakePerTradeBase: "1", maxDailySpendBase: "5", maxOpenPositions: 1, maxPriceRaw: "0" } };

it("saves release intent before sending, then clears a later confirmed revoke from historical state", async () => {
  let saved: CopyProgress | null = PROGRESS;
  const ports = {
    current: vi.fn(async () => null), historical: vi.fn(async () => GRANT),
    receipt: vi.fn(async (): Promise<"success" | "reverted" | null> => null),
    revoke: vi.fn(async () => { expect(saved?.releasePending).toBe(true); return { ok: false, unknown: true, txHash: TX }; }),
    save: vi.fn((progress: CopyProgress | null) => { saved = progress; }),
  };
  expect((await releaseCopyPermission(PROGRESS, OWNER, ports)).ok).toBe(false);
  expect(saved?.releaseTx).toBe(TX);
  expect((await releaseCopyPermission(saved!, OWNER, ports)).ok).toBe(false);
  expect(ports.revoke).toHaveBeenCalledTimes(1);
  vi.mocked(ports.historical).mockResolvedValue({ ...GRANT, revoked: true, budgetBase: 0n });
  expect((await releaseCopyPermission(saved!, OWNER, ports)).ok).toBe(true);
  expect(saved).toBeNull();
  expect(ports.current).not.toHaveBeenCalled();
  expect(ports.revoke).toHaveBeenCalledTimes(1);
});

it("never resends an unknown release with no transaction hash", async () => {
  const ports = { current: vi.fn(async () => GRANT), historical: vi.fn(async () => GRANT), receipt: vi.fn(async () => null), revoke: vi.fn(async () => ({ ok: true })), save: vi.fn() };
  expect(await releaseCopyPermission({ ...PROGRESS, releasePending: true, releaseTx: null }, OWNER, ports)).toMatchObject({ ok: false, reason: expect.stringContaining("not been resent") });
  expect(ports.revoke).not.toHaveBeenCalled();
});

it("blocks another subscription while a release is uncertain", async () => {
  const ports = { load: () => ({ ...PROGRESS, releasePending: true }), save: vi.fn(), strategy: vi.fn(async () => null), grant: vi.fn(async () => null), createGrant: vi.fn(async () => ({ ok: true })), subscribed: vi.fn(async () => false), receipt: vi.fn(async () => null), subscribe: vi.fn(async () => ({ ok: true })), nowSec: 100 };
  expect((await completeCopySetup({ strategyId: 1n, runner: OWNER, depositBase: 0n, budgetBase: 5n, caps: CAPS, feeBase: 0n }, ports)).ok).toBe(false);
  expect(ports.subscribe).not.toHaveBeenCalled();
  expect(ports.createGrant).not.toHaveBeenCalled();
});
