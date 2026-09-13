"use client";

import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { useVaultSnapshot } from "@masayume/markets/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { ClaimReceiptCard } from "./ClaimReceiptCard";
import { CLAIM, X_LINK_STATUS } from "./copy";
import { useXStatus } from "./useXStatus";

const RETURN_TO = "/claim";

const XGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4l13.2 17.3Z" />
  </svg>
);

function Step({ index, label, done, dim, children }: { index: number; label: string; done?: boolean; dim?: boolean; children: ReactNode }) {
  return (
    <div className={`xc-step${dim ? " xc-step--dim" : ""}`}>
      <div className={`xc-step-n${done ? " xc-step-n--done" : ""}`}>{done ? "✓" : index}</div>
      <div className="xc-step-body">
        <div className="xc-step-label">{label}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * /claim, ported from the reference and truth-corrected. The reference claims a sealed
 * auto-account the relay made for someone who bet from a tweet; here a mention only ever
 * executes under a grant the owner created from their own wallet, so what "waits" is the
 * Trading Balance of the wallet the X account routes to. Sign in proves it is the same you;
 * connecting that wallet is the claim.
 */
export function ClaimScreen() {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const link = useXStatus();
  const session = link.status?.session ?? null;
  const binding = link.status?.binding ?? null;
  const boundWallet = binding?.wallet ?? null;
  const vault = useVaultSnapshot(boundWallet as `0x${string}` | null);
  const value = vault && vault.ok ? vault.value : null;
  const amount = value ? formatBaseUnits(value.account.availableBase, value.decimals) : null;
  const handle = session?.handle ?? binding?.handle ?? null;
  const ready = Boolean(address && boundWallet && boundWallet === address.toLowerCase());
  const stage: "in" | "wallet" | "ready" = ready ? "ready" : session ? "wallet" : "in";

  return (
    <div className="xc">
      <div className="xc-rail" />
      <div aria-hidden="true" className="xc-wash xc-wash--v" />
      <div aria-hidden="true" className="xc-wash xc-wash--g" />
      <div className="container xc-main">
        <div className="xc-grid">
          <div className="xc-flow">
            <div className="xc-intro">
              <div className="xc-eyebrow">{CLAIM.eyebrow}</div>
              {amount !== null ? (
                <>
                  <h1 className="xc-h1">
                    <span>{`${amount} ${symbol}`}</span>
                    <span className="xc-h1-word">{CLAIM.headlineKnown}</span>
                  </h1>
                  <p className="xc-lede">{CLAIM.ledeKnown(handle)}</p>
                </>
              ) : (
                <>
                  <h1 className="xc-h1 xc-h1--ask">
                    {CLAIM.headline[0]}
                    <br />
                    {CLAIM.headline[1]}
                  </h1>
                  <p className="xc-lede">{CLAIM.lede}</p>
                </>
              )}
            </div>

            <Step index={1} label={CLAIM.steps.prove} done={Boolean(session)}>
              {session ? (
                <div className="xc-done"><span className="xc-dot" /> {CLAIM.signedInAs(session.handle)}</div>
              ) : link.loading ? (
                <p className="xc-hint" role="status">{X_LINK_STATUS.checking}</p>
              ) : !link.status?.configured ? (
                <p className="xc-hint">{X_LINK_STATUS.unavailable}</p>
              ) : (
                <a href={link.startUrl(RETURN_TO)} className="xc-x-btn">
                  <XGlyph /> {CLAIM.signIn}
                </a>
              )}
            </Step>

            <Step index={2} label={CLAIM.steps.where} done={ready} dim={!session}>
              {!session ? (
                <div className={`${address ? "" : "xc-muted-btn"}`}><ConnectButton /></div>
              ) : !boundWallet ? (
                <>
                  <p className="xc-hint">{CLAIM.noRoute}</p>
                  <Link href="/trade-from-x" className="xc-x-btn xc-mt">{CLAIM.setUp}</Link>
                </>
              ) : !address ? (
                <>
                  <p className="xc-hint">{CLAIM.routesTo(shortHex(boundWallet))}</p>
                  <div className="xc-mt"><ConnectButton /></div>
                </>
              ) : ready ? (
                <div className="xc-done"><span className="xc-dot" /> <span className="xc-done-text">{CLAIM.connected(shortHex(address))}</span></div>
              ) : (
                <>
                  <p className="xc-hint">{CLAIM.otherWallet(shortHex(boundWallet))}</p>
                  <button type="button" onClick={() => void link.link()} disabled={link.busy !== ""} className="xc-x-btn xc-mt">
                    {link.busy === "link" ? CLAIM.linking : CLAIM.relink(session.handle ?? session.authorId)}
                  </button>
                </>
              )}
              {link.error && <p className="xc-err">{link.error}</p>}
            </Step>

            {stage === "ready" && (
              <div className="xc-done-slab">
                <div className="xc-done-slab-title"><span className="xc-dot" /> {CLAIM.thisWallet}</div>
                <Link href="/portfolio" className="xc-cta">{CLAIM.openPortfolio}</Link>
              </div>
            )}

            <p className="xc-foot">{CLAIM.footnote}</p>
          </div>
          <div className="xc-side">
            <ClaimReceiptCard amount={amount} handle={handle} done={stage === "ready"} symbol={symbol} />
          </div>
        </div>
      </div>
    </div>
  );
}
