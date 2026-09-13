"use client";

import { useRef, useState } from "react";
import { diagnosis, type Address, type Hex } from "@masayume/core/types";
import { simulateCaps, type VaultGrant } from "@masayume/core/vault";
import { xPermissionState } from "@masayume/core/x";
import { XWalletCardView, type XGrantState, type XLink } from "@/features/x";
import { updateXPermission, type XUpdateProgress } from "@/features/x/update-permission";
import type { TxOutcome } from "@masayume/core/ports";
import { PLATE, PoolRows } from "@/features/markets/portfolio/plate";

const OWNER = `0x${"11".repeat(20)}` as Address;
const EXECUTOR = `0x${"22".repeat(20)}` as Address;
const REVOKE = `0x${"aa".repeat(32)}` as Hex;
const CREATED = `0x${"bb".repeat(32)}` as Hex;
// A frozen rehearsal clock keeps server HTML and browser hydration identical.
export const X_FIXTURE_NOW_SEC = Date.UTC(2026, 8, 10, 12) / 1000;
const INITIAL: VaultGrant = { grantId: 10n, owner: OWNER, actor: EXECUTOR, kind: "executor", revoked: false,
  expiresAtSec: X_FIXTURE_NOW_SEC + 30 * 86_400, spentDay: 0, spentTodayBase: 0n, openPositions: 0,
  caps: { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 5_000_000n, maxOpenPositions: 8, maxPriceRaw: 0n }, budgetBase: 55_000_000n };
const noop = async () => undefined;
const LINK: XLink = { loading: false, busy: "", error: "", ok: "", needsLink: false, walletMismatch: false, sessionMatchesBinding: true,
  refresh: noop, link: noop, unlink: noop, startUrl: () => "#", setOk: () => undefined, setError: () => undefined,
  status: { configured: true, missing: [], storeConfigured: true, signedIn: true, session: { authorId: "1", handle: "demo_trader" },
    binding: { authorId: "1", handle: "demo_trader", wallet: OWNER, since: 0 }, executor: EXECUTOR, handle: "@masayume_app" } };

/** Interactive rehearsal of the production update state machine, with only its wallet/chain boundaries replaced. */
export function XUpgradeFixture() {
  const state = useRef<{ grant: VaultGrant | null; pending: XUpdateProgress | null; availableBase: bigint }>({ grant: INITIAL, pending: null, availableBase: 12_000_000n });
  const [, render] = useState(0);
  const [busy, setBusy] = useState<"" | "update">("");
  const [mode, setMode] = useState("confirm");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const redraw = () => render((n) => n + 1);
  const update = async () => {
    setBusy("update"); setError(""); setOk("");
    try {
      await updateXPermission(OWNER, EXECUTOR, {
        load: () => state.current.pending,
        save: (pending) => { state.current.pending = pending; redraw(); },
        snapshot: async () => ({ grant: state.current.grant, availableBase: state.current.availableBase }),
        submit: async (intent): Promise<TxOutcome> => {
          if (intent.kind === "vault-revoke") {
            state.current.availableBase += state.current.grant!.budgetBase;
            state.current.grant = null; redraw();
            return { status: "confirmed", txHash: REVOKE };
          }
          if (intent.kind !== "vault-grant") throw new Error("Unexpected write in fixture");
          if (mode === "cancel") return { status: "refused", diagnosis: diagnosis("user-rejected", "fixture cancelled") };
          state.current.availableBase -= intent.terms.budgetBase;
          state.current.grant = { ...INITIAL, ...intent.terms, grantId: 11n }; redraw();
          return mode === "pending" ? { status: "unknown", diagnosis: diagnosis("send-unknown", "fixture timeout"), txHash: CREATED } : { status: "confirmed", txHash: CREATED };
        },
        receipt: async (hash) => ({ status: "success", ...(hash === REVOKE ? { returnedBase: 55_000_000n } : {}) }),
        nowSec: () => X_FIXTURE_NOW_SEC,
      });
      setOk("X trading updated. Your allocated balance is now the spending boundary.");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(""); redraw(); }
  };
  const permission = (executor: string | null) => state.current.pending ? "update" as const : xPermissionState(state.current.grant, executor, X_FIXTURE_NOW_SEC);
  const grant: XGrantState = {
    deployed: true, readable: true, grant: state.current.grant, balanceBase: state.current.grant?.budgetBase ?? 0n,
    availableBase: state.current.availableBase, decimals: 6, pendingUpdate: state.current.pending, permission,
    busy, error, ok, fund: noop, cashOut: noop, update,
    keepReturnedFunds: () => { state.current.pending = null; setError(""); setOk("Update stopped. The returned funds stay in your Trading Balance."); redraw(); },
    clear: () => { setError(""); setOk(""); },
  };
  const trade = () => {
    const g = state.current.grant;
    if (!g) return;
    const nowSec = X_FIXTURE_NOW_SEC;
    const verdict = simulateCaps({ grant: g, nowSec, sidePriceRaw: 500_000n, quantityRaw: 50_000_000n, spendBase: 25_000_000n, one: 1_000_000n, opensNewPosition: true });
    setError("");
    if (!verdict.ok) { setOk(""); setError(`Simulation refused: ${verdict.refusal.kind}. No funds spent.`); return; }
    state.current.grant = { ...g, budgetBase: g.budgetBase - 25_000_000n, spentTodayBase: g.spentTodayBase + 25_000_000n, spentDay: Math.floor(nowSec / 86_400), openPositions: g.openPositions + 1 };
    setOk("Simulated order accepted: 25 tUSDC. No real transaction was sent."); redraw();
  };
  return <section className="flex flex-col gap-3" aria-label="X permission upgrade rehearsal">
    <h2 className="type-body-strong text-ink">Existing account · 55 funded, old 5-per-trade permission</h2>
    <p className="type-body text-ink-secondary">Simulated wallet and chain. Update the permission, then try two 25 tUSDC orders and one over-budget order.</p>
    <label className="type-caption text-ink-secondary">Wallet simulation <select aria-label="Wallet simulation" value={mode} onChange={(e) => setMode(e.target.value)} className="ml-2 rounded border p-2" disabled={Boolean(busy)}>
      <option value="confirm">Confirm both steps</option><option value="cancel">Cancel second confirmation</option><option value="pending">Second confirmation times out</option>
    </select></label>
    <div className="ledger-plate"><PoolRows decimals={6} symbol="tUSDC" pools={[{
      id: "x", label: PLATE.pools.x.label, amountBase: grant.balanceBase, blockedReason: null,
      note: permission(EXECUTOR) === "update" ? PLATE.pools.x.updateNote : PLATE.pools.x.note,
      action: { label: permission(EXECUTOR) === "update" ? PLATE.pools.x.update : PLATE.pools.x.manage, href: "/trade-from-x#x-trading" },
    }]} panels={{ x: <XWalletCardView address={OWNER} link={LINK} grant={grant} compact /> }} /></div>
    <div className="flex flex-wrap gap-3"><button className="rounded border px-3 py-2 text-ink" onClick={trade} disabled={Boolean(busy) || permission(EXECUTOR) !== "ready"}>Simulate 25 tUSDC X order</button>
      <button className="rounded border px-3 py-2 text-ink" onClick={() => { state.current = { grant: INITIAL, pending: null, availableBase: 12_000_000n }; setOk(""); setError(""); setMode("confirm"); redraw(); }}>Reset rehearsal</button></div>
  </section>;
}
