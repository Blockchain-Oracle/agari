"use client";

import type { MakerVaultState } from "@masayume/core/maker";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@masayume/core/units";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConnectButton } from "../markets/wallet";
import { EARN } from "./copy";
import { formatSharePrice, money2, quickAmounts } from "./format";
import type { EarnBusy } from "./useEarnWrites";

interface SupplyCardProps {
  connected: boolean;
  vault: MakerVaultState;
  symbol: string;
  walletBase: bigint | null;
  busy: EarnBusy | null;
  onSupply: (amountBase: bigint) => Promise<boolean> | void;
  onMessage: (text: string) => void;
}

/** The deposit card (`app/earn/page.tsx` L227–268): the amount, Max, wallet-scaled quick amounts, Supply. */
export function SupplyCard({ connected, vault, symbol, walletBase, busy, onSupply, onMessage }: SupplyCardProps) {
  const { supply } = EARN;
  const [amount, setAmount] = useState("");
  const { decimals, paused } = vault;
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
  vault: MakerVaultState;
  symbol: string;
  shares: bigint;
  worthBase: bigint;
  unsettledExpired: boolean;
  busy: EarnBusy | null;
  onWithdraw: (shares: bigint) => void;
}

/**
 * Your position (`app/earn/page.tsx` L270–290): value, shares at the share price, Withdraw all. Ours adds what
 * the reference's venue never had to say: a withdrawal draws on idle capital only, so when the maker has
 * capital deployed the button takes what is idle and names what is still out.
 */
export function PositionCard({ connected, vault, symbol, shares, worthBase, unsettledExpired, busy, onWithdraw }: PositionCardProps) {
  const { position } = EARN;
  const { decimals } = vault;
  // What liquid can pay of this position right now, in shares — the contract refuses more.
  const idleBase = worthBase < vault.liquidBase ? worthBase : vault.liquidBase;
  const idleShares = worthBase === 0n ? 0n : (shares * idleBase) / worthBase;
  const deployedBase = worthBase - idleBase;
  const withdrawing = busy === "withdraw";
  return (
    <div className="earn-card ea-card">
      <div className="ea-k ea-position-title">{position.title}</div>
      {!connected ? (
        <p className="ea-empty">{position.connect}</p>
      ) : shares <= 0n ? (
        <p className="ea-empty">{position.empty}</p>
      ) : (
        <>
          <div className="ea-position-value">
            {money2(worthBase, decimals)} <span className="ea-position-unit">{symbol}</span>
          </div>
          <div className="ea-position-sub">{position.shares(formatBaseUnits(shares, decimals, { minDp: 2, maxDp: 2 }), formatSharePrice(vault.sharePriceRaw, decimals))}</div>
          <button type="button" onClick={() => onWithdraw(idleShares)} disabled={withdrawing || idleShares === 0n} className="earn-ghost ea-withdraw" data-cursor="hover">
            {withdrawing ? position.busy : deployedBase === 0n ? position.withdrawAll : position.withdrawIdle(money2(idleBase, decimals), symbol)}
          </button>
          {deployedBase > 0n && <p className="ea-note">{position.deployedNote(money2(deployedBase, decimals), symbol)}</p>}
          {unsettledExpired && <p className="ea-note">{position.unsettledNote}</p>}
        </>
      )}
    </div>
  );
}
