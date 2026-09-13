"use client";

import { FAUCET_UNITS } from "@masayume/core/constants";
import { formatBaseUnits } from "@masayume/core/units";
import Link from "next/link";
import { OPEN_FUNDS_EVENT } from "@/features/funding";
import { RouteControl, SessionControl, type FundingSource } from "@/features/session";
import { diagnosisCopy, FAUCET, TICKET } from "@/lib/copy";
import type { WalletSession } from "@/lib/wallet-session";
import { useFaucet } from "../faucet";
import { ConnectButton } from "../wallet";

interface RouteChoice {
  show: boolean;
  source: FundingSource;
  onChange: (source: FundingSource) => void;
  vaultAvailableBase: bigint | null;
  armed: boolean;
  deployed: boolean;
}

interface AccountGateProps {
  session: WalletSession;
  /** What the chosen source can put behind a bet; null until the balance sheet has answered. */
  availableBase: bigint | null;
  stakeBase: bigint;
  decimals: number;
  symbol: string;
  balanceSource: "wallet" | "vault" | "private";
  route: RouteChoice | null;
}

/**
 * The account gates, inline (`Ticket624Drawer.tsx` L1124–1173): connect when there is no wallet; "Top up to
 * place this" when the stake is more than the wallet holds, with the way to fix it right there. The
 * reference's third gate ("First bet sets you up") has no counterpart — a wallet bet needs no account.
 *
 * Two things of ours live here because this is where the reference keeps its account split: the
 * Wallet / Trading Balance choice when a Trading Balance exists, and the tap-trading chip. The faucet
 * used to appear only at exactly zero and *replaced* the bet button; now it is one of the top-up's actions.
 */
export function AccountGate({ session, availableBase, stakeBase, decimals, symbol, balanceSource, route }: AccountGateProps) {
  const faucet = useFaucet();
  const connected = session.isConnected;
  const short = connected && availableBase !== null && (availableBase === 0n || (stakeBase > 0n && stakeBase > availableBase));
  const needBase = availableBase !== null && stakeBase > availableBase ? stakeBase - availableBase : null;
  const minting = faucet.busy;
  const walletBalance = balanceSource === "wallet";
  const balanceLabel = walletBalance ? "Wallet" : balanceSource === "private" ? "Private balance" : "Trading Balance";

  return (
    <>
      {!connected && (
        <div className="tk-gate">
          <p className="tk-gate-body">{TICKET.gate.connect}</p>
          <ConnectButton />
        </div>
      )}
      {short && (
        <div className="tk-gate tk-gate--warn" role="status">
          <div className="tk-gate-eyebrow">{TICKET.gate.topUp}</div>
          <p className="tk-gate-line">
            {TICKET.gate.holds(formatBaseUnits(availableBase ?? 0n, decimals), symbol, balanceLabel)}
            {walletBalance
              ? needBase !== null ? ` ${TICKET.gate.need(formatBaseUnits(needBase, decimals), symbol)}` : ` ${TICKET.gate.empty}`
              : balanceSource === "private" ? " Fund and authorize your private balance on Portfolio before placing a private bet." : " Add funds to your Trading Balance on Portfolio, or switch to Wallet."}
          </p>
          {faucet.state.diagnosis && <p className="tk-gate-line">{diagnosisCopy(faucet.state.diagnosis.kind).headline}</p>}
          <div className="tk-gate-actions">
            {walletBalance ? <button type="button" className="tk-gate-cta" onClick={() => window.dispatchEvent(new Event(OPEN_FUNDS_EVENT))} data-cursor="hover">
              {TICKET.gate.addMoney}
            </button> : <Link className="tk-gate-cta" href="/portfolio">{balanceSource === "private" ? "Manage private balance" : "Manage Trading Balance"}</Link>}
            {walletBalance && faucet.hasSigner && (
              <button type="button" className="tk-gate-quiet" disabled={minting} onClick={() => window.dispatchEvent(new Event(OPEN_FUNDS_EVENT))} data-cursor="hover">
                {minting ? faucet.label : FAUCET.cta(String(FAUCET_UNITS))}
              </button>
            )}
          </div>
        </div>
      )}
      {connected && (
        <div className="tk-gate-row">
          {route?.show ? (
            <RouteControl source={route.source} onChange={route.onChange} vaultAvailableBase={route.vaultAvailableBase} decimals={decimals} symbol={symbol} armed={route.armed} deployed={route.deployed} />
          ) : (
            <span />
          )}
          {balanceSource !== "private" && <SessionControl symbol={symbol} />}
        </div>
      )}
    </>
  );
}
