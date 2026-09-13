"use client";

import { formatBaseUnits, formatUtc } from "@masayume/core/units";
import type { XGrantState } from "./useXGrant";
import { X_CARD } from "./copy";

/** The same permission and recovery action in Portfolio and the X setup page. */
export function XPermissionPanel({ grant, executor, symbol, disabled = false }: {
  grant: XGrantState; executor: string | null; symbol: string; disabled?: boolean;
}) {
  const state = grant.permission(executor);
  const needsUpdate = ["update", "expired", "mismatch"].includes(state);
  const pending = grant.pendingUpdate;
  const title = pending ? "Finish updating X trading" : state === "ready" ? "X trading enabled"
    : state === "update" ? "Update X trading to use your balance"
    : state === "expired" ? "Renew X trading"
    : state === "mismatch" ? "Reconnect X trading"
    : state === "checking" ? "Checking X trading…"
    : state === "unavailable" ? "X trading status unavailable" : "Fund your X trading balance";
  const detail = pending?.stage === "grant-ready"
    ? `${formatBaseUnits(BigInt(pending.returnedBase ?? "0"), grant.decimals)} ${symbol} returned to your Trading Balance. Continue to use it for X trading.`
    : pending ? "Your progress is saved. Continue to verify the last transaction before any further wallet action."
    : state === "update" ? "Your existing permission still has the old spending limits. Update it to trade from your full X balance."
    : state === "expired" ? "Your permission expired. Your remaining X funds are still here."
    : state === "mismatch" ? "Your permission names a previous executor. Reconnect it to the current X service."
    : state === "unavailable" ? "We could not verify your balance and trading permission. Try again shortly."
    : state === "checking" ? "Reading your balance and permission."
    : X_CARD.budgetPolicy;
  return <div className={`xw-permission${needsUpdate ? " xw-permission--action" : ""}`} role="status">
    <p className="xw-slab-title">{title}</p>
    <p className="xw-slab-body">{detail}</p>
    {needsUpdate && <>
      <p className="xw-slab-body">{X_CARD.budgetPolicy}</p>
      <p className="xw-slab-note">{pending ? "No additional deposit. Existing positions stay yours." : "Two wallet confirmations. Reuse your remaining X funds; no additional deposit."}</p>
      <button type="button" className="xw-btn-v" disabled={disabled || !grant.readable || Boolean(grant.busy) || !executor}
        onClick={() => void grant.update(executor)}>
        {grant.busy === "update" ? "Confirm in your wallet…" : pending ? "Continue X trading update" : state === "expired" ? "Renew X trading" : state === "mismatch" ? "Reconnect X trading" : "Update X trading"}
      </button>
      {pending?.stage === "grant-ready" && <button type="button" className="xw-btn-ink" disabled={Boolean(grant.busy)} onClick={grant.keepReturnedFunds}>Keep funds in Trading Balance</button>}
    </>}
    {state === "ready" && grant.grant && <p className="xw-slab-note">
      {grant.grant.openPositions}/{grant.grant.caps.maxOpenPositions} open Windows · expires {formatUtc(grant.grant.expiresAtSec * 1000, { withSeconds: false, withDate: true })}
    </p>}
    {pending?.txHash && <a className="xw-btn-ink" href={`https://shannon-explorer.somnia.network/tx/${pending.txHash}`} target="_blank" rel="noreferrer">View update transaction ↗</a>}
  </div>;
}
