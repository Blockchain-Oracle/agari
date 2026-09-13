"use client";

import { formatBaseUnits, parseDecimalToBaseUnits, shortHex } from "@masayume/core/units";
import { ChevronDown, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { X_CARD, X_HANDLE, X_LINK_STATUS } from "./copy";
import { useXGrant, type XGrantState } from "./useXGrant";
import { useXStatus, type XLink } from "./useXStatus";
import { XPermissionPanel } from "./XPermissionPanel";

const QUICK = ["5", "10", "25"] as const;

/** The X mark (the reference used lucide's Twitter bird; this lucide has no X glyph). */
const XGlyph = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4l13.2 17.3Z" />
  </svg>
);

export interface XWalletCardProps {
  /** Nested in the portfolio plate the heading and the balance repeat the row that opened it, so both are dropped. */
  compact?: boolean;
  returnTo?: string;
  symbol?: string;
}

/** The X-Predict wallet (reference `XWalletCard.tsx`), over an EXECUTOR grant: WHO this balance bets for comes first. */
export function XWalletCard({ compact = false, returnTo = "/portfolio", symbol = "tUSDC" }: XWalletCardProps) {
  const { address } = useWalletSession();
  const link = useXStatus();
  const grant = useXGrant();
  return <XWalletCardView address={address} link={link} grant={grant} compact={compact} returnTo={returnTo} symbol={symbol} />;
}

export interface XWalletCardViewProps extends XWalletCardProps {
  address: string | null;
  link: XLink;
  grant: XGrantState;
}

/** The card as pure presentation, so the fixture page can show every state without a wallet. */
export function XWalletCardView({ address, link, grant, compact = false, returnTo = "/portfolio", symbol = "tUSDC" }: XWalletCardViewProps) {
  const [amount, setAmount] = useState("5");
  const [manage, setManage] = useState(false);
  const [source, setSource] = useState<"wallet" | "trading-balance">("wallet");
  const status = link.status;
  const session = status?.session ?? null;
  const binding = status?.binding ?? null;
  const connected = Boolean(session || binding);
  const boundWallet = binding?.wallet ?? null;
  const startHref = link.startUrl(returnTo);
  const balance = grant.balanceBase;
  const shownBalance = balance === null ? "—" : formatBaseUnits(balance, grant.decimals);
  const permission = grant.permission(status?.executor ?? null);
  const canFund = ["ready", "unfunded"].includes(permission) && !grant.pendingUpdate;
  const busy = grant.busy || link.busy;
  const err = grant.error || link.error;
  const ok = grant.ok || link.ok;

  const fund = () => {
    if (link.walletMismatch) return grant.clear(), link.setError(X_CARD.wrongWalletFund);
    const base = parseDecimalToBaseUnits(amount || "0", grant.decimals);
    if (!base || base <= 0n) return link.setError(X_CARD.enterAmount);
    void grant.fund(base, status?.executor ?? null, source);
  };

  return (
    <section id="x-wallet" className="xw">
      {!compact && (
        <div className="xw-head">
          <XGlyph className="xw-head-icon" />
          <h2 className="xw-title">{X_CARD.title}</h2>
        </div>
      )}
      <div className={compact ? "" : "ledger-plate"}>
        {!link.loading &&
          (link.walletMismatch && boundWallet ? (
            <div className="xw-slab xw-slab--hard">
              <div className="xw-slab-title">{X_CARD.wrongWallet(binding?.handle ?? "this X account")}</div>
              <p className="xw-slab-body">
                {X_CARD.itBetsFrom} <span className="xw-mono">{shortHex(boundWallet)}</span>
                {X_CARD.connectedAs} <span className="xw-mono">{shortHex(address ?? "")}</span>
                {X_CARD.strandedNote}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void navigator.clipboard?.writeText(boundWallet).then(() => link.setOk(X_CARD.copied))} className="xw-btn-ink">
                  {X_CARD.copyAddress(shortHex(boundWallet))}
                </button>
              </div>
              <p className="xw-slab-note">{X_CARD.notInBrowser}</p>
            </div>
          ) : link.needsLink && session ? (
            <div className="xw-slab">
              <div className="xw-slab-title">
                {binding ? X_CARD.switchQuestion(binding.handle ?? binding.authorId, session.handle ?? session.authorId) : X_CARD.oneMoreStep(session.handle ?? session.authorId)}
              </div>
              {binding && <p className="xw-slab-body">{X_CARD.switchNote}</p>}
              <button type="button" onClick={() => void link.link()} disabled={busy !== ""} className="xw-btn-v">
                <XGlyph className="xw-icon" /> {link.busy === "link" ? X_CARD.linking : binding ? X_CARD.useHandle(session.handle ?? session.authorId) : X_CARD.linkHandle(session.handle ?? session.authorId)}
              </button>
            </div>
          ) : connected ? (
            <div className="xw-conn">
              <button type="button" onClick={() => setManage((v) => !v)} aria-expanded={manage} className="xw-conn-row">
                <span className="xw-icon--s" style={{ color: "var(--xw-v)" }}><XGlyph className="xw-icon--s" /></span>
                <span className="xw-conn-handle">{binding?.handle ? `@${binding.handle}` : X_CARD.xConnected}</span>
                <ChevronDown className={`xw-conn-chevron${manage ? " xw-conn-chevron--open" : ""}`} />
              </button>
              {manage && (
                <div className="xw-manage">
                  <a href={startHref} className="xw-btn-ink">
                    <RefreshCw className="xw-icon--s" /> {X_CARD.switchAccount}
                  </a>
                  {link.sessionMatchesBinding ? (
                    <button type="button" onClick={() => void link.unlink()} disabled={busy !== ""} className="xw-btn-loss">
                      <Unlink className="xw-icon--s" /> {link.busy === "unlink" ? X_CARD.disconnecting : X_CARD.disconnect}
                    </button>
                  ) : (
                    <a href={startHref} className="xw-verify">{X_CARD.verifyToDisconnect}</a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={balance && balance > 0n ? "xw-slab xw-slab--quiet" : "xw-slab"}>
              <div className="xw-slab-title">{balance && balance > 0n ? X_CARD.linkToBet : X_CARD.connectFirst}</div>
              {!status?.configured ? (
                <p className="xw-slab-note">{X_LINK_STATUS.unavailable}</p>
              ) : (
                <a href={startHref} className="xw-btn-v">
                  <XGlyph className="xw-icon" /> {X_CARD.connectX}
                </a>
              )}
              {err && <div className="xw-err">{err}</div>}
            </div>
          ))}

        {!address ? (
          <div className="xw-connect-note">{X_CARD.connectWallet}</div>
        ) : (
          <>
            <div className="xw-balance-row">
              <div>
                {!compact && (
                  <>
                    <span className="xw-balance-label">{X_CARD.balanceLabel}</span>
                    <div className="xw-balance">
                      {shownBalance}
                      <span className="xw-balance-unit">{symbol}</span>
                    </div>
                  </>
                )}
              </div>
              {balance !== null && balance > 0n && (
                <button type="button" onClick={() => void grant.cashOut()} disabled={busy !== "" || !grant.readable || Boolean(grant.pendingUpdate)} className="xw-btn-out">
                  {grant.busy === "cashout" ? X_CARD.cashingOut : X_CARD.cashOut} ↗
                </button>
              )}
            </div>
            <XPermissionPanel grant={grant} executor={status?.executor ?? null} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} />
            {canFund && <>
            {grant.availableBase !== null && grant.availableBase > 0n && <fieldset className="xw-source">
              <legend>Fund from</legend>
              <div className="xw-source-options">
                <button type="button" aria-pressed={source === "wallet"} disabled={Boolean(busy)} onClick={() => setSource("wallet")}>
                  <strong>Connected wallet</strong><span>Add wallet funds</span>
                </button>
                <button type="button" aria-pressed={source === "trading-balance"} disabled={Boolean(busy)} onClick={() => setSource("trading-balance")}>
                  <strong>Trading Balance</strong><span>{formatBaseUnits(grant.availableBase, grant.decimals)} {symbol} available</span>
                </button>
              </div>
            </fieldset>}
            <div className="xw-fund">
              <div className="xw-quick">
                {QUICK.map((v) => (
                  <button key={v} type="button" disabled={Boolean(busy)} onClick={() => setAmount(v)} className={`xw-quick-btn${amount === v ? " xw-quick-btn--on" : ""}`}>
                    ${v}
                  </button>
                ))}
                <div className="xw-amount">
                  <span className="xw-amount-sign">$</span>
                  <input value={amount} disabled={Boolean(busy)} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label={X_CARD.amountAria} />
                  <span className="xw-amount-unit">{symbol}</span>
                </div>
              </div>
              <button type="button" onClick={fund} disabled={busy !== "" || !grant.readable || link.walletMismatch} className="xw-btn-fill">
                {grant.busy === "fund" ? X_CARD.funding : X_CARD.fund}
              </button>
            </div>
            </>}
            {grant.deployed === false && <div className="xw-err">{X_CARD.notDeployed}</div>}
            {err && <div className="xw-err" role="alert">{err}</div>}
            {ok && <div className="xw-ok" role="status">{ok}</div>}
          </>
        )}

        <div className="xw-foot">{link.loading ? X_CARD.checking : binding && !link.needsLink && !link.walletMismatch && permission === "ready" ? X_CARD.howTo(X_HANDLE) : connected ? "Complete the steps above before tweeting a trade." : null}</div>
      </div>
    </section>
  );
}
