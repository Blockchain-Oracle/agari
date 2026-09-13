import { describe, expect, it, vi } from "vitest";
import { diagnosis, type Address, type Hex } from "@masayume/core/types";
import type { VaultGrant } from "@masayume/core/vault";
import type { TxOutcome } from "@masayume/core/ports";
import { isBalanceOnlyXGrant } from "@masayume/core/x";
import { parseXUpdate, updateXPermission, type XUpdateDependencies, type XUpdateProgress } from "./update-permission";

const OWNER = `0x${"11".repeat(20)}` as Address;
const ACTOR = `0x${"22".repeat(20)}` as Address;
const REVOKE = `0x${"aa".repeat(32)}` as Hex;
const GRANT = `0x${"bb".repeat(32)}` as Hex;
const old: VaultGrant = { grantId: 10n, owner: OWNER, actor: ACTOR, kind: "executor", revoked: false, expiresAtSec: 2000,
  spentDay: 0, spentTodayBase: 0n, openPositions: 0, caps: { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 5_000_000n, maxOpenPositions: 8, maxPriceRaw: 0n }, budgetBase: 55_000_000n };

function fixture(returnedBase = 55_000_000n) {
  let saved: XUpdateProgress | null = null;
  let current: VaultGrant | null = old;
  const deps: XUpdateDependencies = {
    load: () => saved,
    save: vi.fn((progress) => { saved = progress ? parseXUpdate(JSON.stringify(progress)) : null; }),
    snapshot: vi.fn(async () => ({ grant: current, availableBase: 1_000_000_000n })),
    submit: vi.fn(async (intent): Promise<TxOutcome> => {
      expect(saved?.stage).toMatch(/pending$/);
      if (intent.kind === "vault-revoke") { current = null; return { status: "confirmed", txHash: REVOKE }; }
      if (intent.kind !== "vault-grant") throw new Error("Unexpected deposit or other write");
      current = { ...old, ...intent.terms, grantId: 11n };
      return { status: "confirmed", txHash: GRANT };
    }),
    receipt: vi.fn(async (hash) => ({ status: "success" as const, ...(hash === REVOKE ? { returnedBase } : {}) })),
    nowSec: () => 1000,
  };
  return { deps, saved: () => saved, current: () => current };
}

describe("X permission update recovery", () => {
  it("reuses exactly the returned budget with no new deposit or extra allocation", async () => {
    const f = fixture(51_000_000n); // An order spent 4 while the owner was confirming the revoke.
    await updateXPermission(OWNER, ACTOR, f.deps);
    expect(f.deps.submit).toHaveBeenCalledTimes(2);
    expect(f.current()?.budgetBase).toBe(51_000_000n);
    expect(isBalanceOnlyXGrant(f.current()!)).toBe(true);
    expect(f.saved()).toBeNull();
  });
  it("continues after the second wallet confirmation is cancelled without revoking or depositing again", async () => {
    const f = fixture();
    const original = f.deps.submit;
    let declined = false;
    f.deps.submit = vi.fn(async (intent): Promise<TxOutcome> => {
      if (intent.kind === "vault-grant" && !declined) { declined = true; return { status: "refused", diagnosis: diagnosis("user-rejected", "cancelled") }; }
      return original(intent);
    });
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("cancelled");
    expect(f.saved()?.stage).toBe("grant-ready");
    await updateXPermission(OWNER, ACTOR, f.deps);
    expect(f.deps.submit).toHaveBeenCalledTimes(3);
    expect(f.saved()).toBeNull();
  });
  it("checks a timed-out revocation receipt before continuing, with no repeat revoke", async () => {
    const f = fixture();
    const original = f.deps.submit;
    f.deps.submit = vi.fn(async (intent): Promise<TxOutcome> => {
      const result = await original(intent);
      return intent.kind === "vault-revoke" ? { status: "unknown", txHash: REVOKE, diagnosis: diagnosis("send-unknown", "timeout") } : result;
    });
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("needs checking");
    expect(f.saved()?.stage).toBe("revoke-pending");
    await updateXPermission(OWNER, ACTOR, f.deps);
    expect(f.deps.submit).toHaveBeenCalledTimes(2);
  });
  it("does not repeat an uncertain grant once its receipt confirms", async () => {
    const f = fixture();
    const original = f.deps.submit;
    f.deps.submit = vi.fn(async (intent): Promise<TxOutcome> => {
      const result = await original(intent);
      return intent.kind === "vault-grant" ? { status: "unknown", txHash: GRANT, diagnosis: diagnosis("send-unknown", "timeout") } : result;
    });
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("needs checking");
    await updateXPermission(OWNER, ACTOR, f.deps);
    expect(f.deps.submit).toHaveBeenCalledTimes(2);
    expect(f.saved()).toBeNull();
  });
  it("holds uncertain sends without a hash instead of replaying them", async () => {
    const f = fixture();
    f.deps.submit = vi.fn(async (): Promise<TxOutcome> => ({ status: "unknown", diagnosis: diagnosis("send-unknown", "timeout") }));
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("needs checking");
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("needs checking");
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
  });
  it("requires a verified returned amount before creating the new grant", async () => {
    const f = fixture();
    f.deps.receipt = vi.fn(async () => ({ status: "success" as const }));
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("returned X balance");
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
  });
  it("does not start a wallet action if durable progress cannot be saved", async () => {
    const f = fixture();
    f.deps.save = () => { throw new Error("storage blocked"); };
    await expect(updateXPermission(OWNER, ACTOR, f.deps)).rejects.toThrow("storage blocked");
    expect(f.deps.submit).not.toHaveBeenCalled();
  });
  it("rejects malformed recovery state", () => {
    for (const raw of ["{}", "null", "[", JSON.stringify({ version: 1, stage: "grant-ready" })]) expect(parseXUpdate(raw)).toBeNull();
  });
});
