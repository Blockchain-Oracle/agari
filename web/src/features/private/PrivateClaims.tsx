"use client";

import { formatCadence } from "@masayume/core/copy";
import type { PrivateTicket } from "@masayume/core/private";
import type { Address } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { Download, Loader2, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { useTick } from "@masayume/markets/react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { exportPrivateClaims, importPrivateClaims } from "./claims-store";
import { PRIVATE } from "./copy";
import { verifyTicket } from "./verify";
import "./private-claims.css";

export interface PrivateClaimsProps {
  claims: PrivateTicket[];
  /** The key the contract pins; null while unread, in which case the ticket's own says who signed. */
  pinnedDesk: Address | null;
  contract: Address | null;
  chainId: number;
  owner: string | null;
  decimals: number;
  symbol: string;
  onCashOut?: (claim: PrivateTicket) => void;
  busySlot?: string | null;
  /** Something a person did that the list should know about (a restore, a cash-out) — re-reads storage. */
  onChanged?: () => void;
}

/** Two open bets on different BTC 4h Windows must not read as one row: the close time tells them apart (the reference's strike did). */
function closeLabel(expirySec: number): string {
  return `${new Date(expirySec * 1000).toISOString().slice(11, 16)} UTC`;
}

function sinceLabel(ts: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - ts) / 60_000));
  if (mins < 1) return PRIVATE.claims.just;
  if (mins < 60) return PRIVATE.claims.minutes(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return PRIVATE.claims.hours(hrs);
  return PRIVATE.claims.days(Math.round(hrs / 24));
}

/**
 * Your private positions, and the proof each one is yours — `reference/yosuku/components/PrivateClaims.tsx`.
 *
 * The desk keeps no record of who owns which position, so nobody there can read your bets, and nobody there
 * can reconstruct your claim if you lose it. That makes "keep a copy" a real thing a person has to do, so the
 * backup control is a primary action here. The verify control is the other half: it checks the desk's
 * signature locally, against the key pinned on the contract, so trusting the claim never requires trusting us.
 */
export function PrivateClaims({ claims, pinnedDesk, contract, chainId, owner, decimals, symbol, onCashOut, busySlot, onChanged }: PrivateClaimsProps) {
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [restored, setRestored] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // A ticking clock, so "3m ago" advances while the page is open (the reference re-read its rows every 4 s)
  const beat = useTick(15_000);
  const nowMs = useMemo(() => Date.now(), [beat]);

  // Verify every claim on sight. Making the user press a button to find out their bet is real would be putting the burden in the wrong place.
  useEffect(() => {
    let cancelled = false;
    // Until the contract's pinned key is known there is nothing honest to check against: the rows stay "Checking".
    if (pinnedDesk === null) {
      setVerified({});
      return;
    }
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const c of claims) next[c.claim.slotId] = await verifyTicket(c, pinnedDesk, contract, chainId);
      if (!cancelled) setVerified(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [claims, pinnedDesk, contract, chainId]);

  const backUp = useCallback(() => {
    const blob = new Blob([exportPrivateClaims(owner)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PRIVATE.claims.fileName(new Date().toISOString().slice(0, 10));
    a.click();
    URL.revokeObjectURL(url);
  }, [owner]);

  const restore = useCallback(
    async (file: File) => {
      try {
        const { added, skipped } = importPrivateClaims(await file.text());
        setRestored(added > 0 ? PRIVATE.claims.restored(added, skipped) : skipped > 0 ? PRIVATE.claims.skipped(skipped) : PRIVATE.claims.nothingNew);
        onChanged?.();
      } catch {
        setRestored(PRIVATE.claims.unreadable);
      }
    },
    [onChanged],
  );

  return (
    <div className="pc">
      <div className="pc-head">
        <div>
          <h3 className="pc-title">{PRIVATE.claims.title}</h3>
          <p className="pc-sub">{PRIVATE.claims.sub}</p>
        </div>
        <div className="pc-actions">
          <button type="button" onClick={backUp} disabled={claims.length === 0} className="pc-btn disabled:cursor-not-allowed disabled:opacity-40" data-cursor="hover">
            <Download className="pc-icon" aria-hidden />
            {PRIVATE.claims.backUp}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="pc-btn" data-cursor="hover">
            <Upload className="pc-icon" aria-hidden />
            {PRIVATE.claims.restore}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            aria-label="Restore private positions from a backup"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {restored && (
        <p className="pc-note" role="status">
          {restored}
        </p>
      )}
      {claims.some((c) => verified[c.claim.slotId] === false) && <p className="pc-warn">{PRIVATE.claims.warn}</p>}

      {claims.length === 0 && (
        <div className="pc-empty">
          <p className="pc-empty-title">{PRIVATE.claims.emptyTitle}</p>
          <p className="pc-empty-sub">{PRIVATE.claims.emptySub}</p>
        </div>
      )}

      <ul className="pc-list">
        {claims.map((c) => {
          const ok = verified[c.claim.slotId];
          const busy = busySlot === c.claim.slotId;
          const stake = BigInt(c.claim.stakeBase);
          const payout = c.payoutBase !== undefined ? BigInt(c.payoutBase) : null;
          const side = c.claim.outcomeIdx === 0 ? "UP" : "DOWN";
          return (
            <li key={c.claim.slotId} className="pc-row">
              <div className="pc-row-main">
                <span className={cn("pc-side", c.claim.outcomeIdx === 0 ? "is-up" : "is-down")}>{side}</span>
                <span className="pc-strike">
                  {c.asset} {formatCadence(c.intervalSec)} · {closeLabel(c.expirySec)}
                </span>
                <span className="pc-stake">
                  {formatBaseUnits(stake, decimals)} {symbol}
                </span>
                {/* What you actually won. A settled row that only shows the stake makes a person do arithmetic to find out how they did —
                    but only when this browser saw the settlement; a row credited elsewhere shows what came home, never a made-up loss. */}
                {payout !== null && c.status !== "open" && (
                  <span className={cn("pc-payout", payout >= stake ? "is-win" : "is-loss")}>
                    {payout >= stake ? "+" : "−"}
                    {formatBaseUnits(payout >= stake ? payout - stake : stake - payout, decimals)}
                  </span>
                )}
                {payout === null && c.status === "credited" && c.creditedBase !== undefined && (
                  <span className="pc-stake">{PRIVATE.claims.home(formatBaseUnits(BigInt(c.creditedBase), decimals), symbol)}</span>
                )}
                <span className="pc-when">{sinceLabel(c.openedAtMs, nowMs)}</span>
              </div>
              <div className="pc-row-side">
                {ok === undefined ? (
                  <span className="pc-check is-checking">{PRIVATE.claims.checking}</span>
                ) : ok ? (
                  <span className="pc-check is-ok" title={PRIVATE.claims.verifiedTitle}>
                    <ShieldCheck className="pc-icon" aria-hidden />
                    {PRIVATE.claims.verified}
                  </span>
                ) : (
                  <span className="pc-check is-bad" title={PRIVATE.claims.unverifiedTitle}>
                    <ShieldAlert className="pc-icon" aria-hidden />
                    {PRIVATE.claims.unverified}
                  </span>
                )}
                {c.status === "open" && onCashOut && (
                  <button type="button" onClick={() => onCashOut(c)} disabled={busy || ok === false} className="pc-cash" data-cursor="hover">
                    {busy ? <Loader2 className="pc-icon animate-spin" aria-hidden /> : null}
                    {busy ? PRIVATE.claims.cashingOut : PRIVATE.claims.cashOut}
                  </button>
                )}
                {c.status !== "open" && <span className="pc-status">{c.status === "credited" ? PRIVATE.claims.credited : PRIVATE.claims.settled}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="pc-foot">{PRIVATE.claims.foot}</p>
    </div>
  );
}
