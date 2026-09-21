"use client";

import { realizedYield, supplierPosition, type ReserveSheet } from "@agari/core/reserves";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { KeepCase } from "@/components/data";
import { cn } from "@/lib/utils";
import { ConnectButton } from "../markets/wallet";
import { EARN } from "./copy";
import { formatSharePrice, money2, quickAmounts } from "./format";
import type { ReserveWords } from "./reserves";

interface SupplyCardProps {
  connected: boolean;
  sheet: ReserveSheet;
  symbol: string;
  walletBase: bigint | null;
  busy: string | null;
  onSupply: (amountBase: bigint) => Promise<boolean> | void;
  onMessage: (text: string) => void;
}

/** The deposit card (`app/earn/page.tsx` L227–268): the amount, Max, wallet-scaled quick amounts, Supply. */
export function SupplyCard({ connected, sheet, symbol, walletBase, busy, onSupply, onMessage }: SupplyCardProps) {
  const { supply } = EARN;
  const [amount, setAmount] = useState("");
  const { decimals, paused } = sheet;
  // null while the balance sheet is still reading: the line says so, and nothing is sized off a zero that is not one.
  const wallet = walletBase ?? 0n;
  const walletText = formatBaseUnits(wallet, decimals, { minDp: 2, maxDp: 2, group: false });

  const submit = () => {
    if (paused) return;
    let base = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
    if (base <= 0n) return onMessage(supply.enterAmount);
    if (walletBase === null) return onMessage(supply.walletReading);
    if (wallet <= 0n) return onMessage(supply.noFunds(symbol));
    if (base > wallet) base = wallet;
    // Cleared only once the supply lands (the reference clears inside its success branch); a rejected signature keeps the figure.
    void Promise.resolve(onSupply(base)).then((ok) => {
      if (ok) setAmount("");
    });
  };

  return (
    <div className="earn-card ea-card">
      {!connected ? (
        <div className="ea-connect">
          <p className="ea-connect-text">{supply.connect}</p>
          <div className="ea-connect-cta">
            <ConnectButton />
          </div>
        </div>
      ) : (
        <>
          <div className="ea-field-head">
            <span className="ea-k">{supply.amount}</span>
            <span className="ea-wallet">{walletBase === null ? supply.walletPending : supply.wallet(money2(wallet, decimals), symbol)}</span>
          </div>
          <div className="earn-field ea-field">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" className="ea-input" aria-label={supply.amount} />
            <button type="button" onClick={() => setAmount(walletText)} disabled={walletBase === null} className="ea-max" data-cursor="hover">
              {supply.max}
            </button>
            <span className="ea-input-unit">{symbol}</span>
          </div>
          <div className="ea-quick">
            {quickAmounts(wallet, decimals).map((a) => (
              <button key={a} type="button" onClick={() => setAmount(a)} className={cn("ea-quick-chip", amount === a ? "ea-quick-chip--on" : "earn-chip")} data-cursor="hover">
                {a}
              </button>
            ))}
          </div>
          <button type="button" onClick={submit} disabled={busy === "supply" || paused} className="ea-supply" data-cursor="hover">
            {paused ? supply.pausedButton : busy === "supply" ? supply.busy : supply.button(symbol)}
          </button>
        </>
      )}
    </div>
  );
}

interface PositionCardProps {
  connected: boolean;
  sheet: ReserveSheet;
  words: ReserveWords;
  symbol: string;
  shares: bigint;
  worthBase: bigint;
  /** The provider account's lifetime counters, for the realized line (A-2c). */
  suppliedBase: bigint;
  withdrawnBase: bigint;
  /** Maker only: a closed Window the exit has to settle first, which the note names before it is sent. */
  unsettledExpired?: boolean;
  busy: string | null;
  onWithdraw: (shares: bigint) => void;
}

/**
 * Your position (`app/earn/page.tsx` L270–290): value, shares at the share price, Withdraw all. Ours adds what
 * the reference's venue never had to say: every reserve pays a withdrawal out of free capital only, so the
 * button takes what is free and the note names what the reserve is still holding, in that reserve's own word.
 */
export function PositionCard({ connected, sheet, words, symbol, shares, worthBase, suppliedBase, withdrawnBase, unsettledExpired = false, busy, onWithdraw }: PositionCardProps) {
  const { position } = EARN;
  const { decimals } = sheet;
  const held = supplierPosition(sheet, shares, worthBase);
  // A-2c: what has actually been paid back above cost, and what is still only a mark. Never a rate, never a forecast.
  const earned = realizedYield({ suppliedBase, withdrawnBase, worthBase });
  const withdrawing = busy === "withdraw";
  return (
    <div className="earn-card ea-card">
      <div className="ea-k ea-position-title">{position.title}</div>
      {!connected ? (
        <p className="ea-empty">{position.connect}</p>
      ) : held.shares <= 0n && earned.realizedBase <= 0n ? (
        <p className="ea-empty">{position.empty}</p>
      ) : (
        <>
          <div className="ea-position-value">
            {money2(held.worthBase, decimals)} <span className="ea-position-unit">{symbol}</span>
          </div>
          <div className="ea-position-sub">{position.shares(formatBaseUnits(held.shares, decimals, { minDp: 2, maxDp: 2 }), formatSharePrice(sheet.sharePriceRaw, decimals))}</div>
          <button type="button" onClick={() => onWithdraw(held.idleShares)} disabled={withdrawing || held.idleShares === 0n} className="earn-ghost ea-withdraw" data-cursor="hover">
            {withdrawing ? position.busy : held.committedBase === 0n ? position.withdrawAll : <KeepCase text={position.withdrawIdle(money2(held.idleBase, decimals), symbol)} symbol={symbol} />}
          </button>
          <dl className="ea-earned">
            <div>
              <dt className="ea-k">{EARN.position.realizedLabel}</dt>
              <dd className={earned.realizedBase > 0n ? "ea-earned-v ea-earned-v--up" : "ea-earned-v"}>
                {earned.realizedBase > 0n ? position.realized(money2(earned.realizedBase, decimals), symbol) : position.realizedNone}
              </dd>
            </div>
            {held.shares > 0n && (
              <div>
                <dt className="ea-k">{EARN.position.unrealizedLabel}</dt>
                <dd className={earned.unrealizedBase < 0n ? "ea-earned-v ea-earned-v--down" : "ea-earned-v"}>
                  {earned.unrealizedBase < 0n
                    ? position.unrealizedDown(money2(-earned.unrealizedBase, decimals), symbol)
                    : position.unrealized(money2(earned.unrealizedBase, decimals), symbol)}
                </dd>
              </div>
            )}
          </dl>
          {held.committedBase > 0n && <p className="ea-note">{words.committedNote(money2(held.committedBase, decimals), symbol)}</p>}
          {unsettledExpired && <p className="ea-note">{position.unsettledNote}</p>}
        </>
      )}
    </div>
  );
}
