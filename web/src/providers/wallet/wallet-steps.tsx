"use client";

import { KNOWN_WALLETS, WALLET_MODAL } from "./copy";
import { ActionButton, Spinner, WalletIcon } from "./wallet-modal-parts";

const T = WALLET_MODAL;

/** RainbowKit's `ConnectModalIntro` ("What is a Wallet?"), compact: the two illustrated points, Get a Wallet, Learn More. */
export function IntroStep({ onGetWallet }: { onGetWallet: () => void }) {
  return (
    <div className="wm-intro">
      <div className="wm-intro-top" />
      <div className="wm-intro-features">
        <Feature art="/wallet/assets.svg" title={T.intro.assetsTitle} body={T.intro.assetsBody} />
        <Feature art="/wallet/login.svg" title={T.intro.loginTitle} body={T.intro.loginBody} />
      </div>
      <div className="wm-intro-actions">
        <ActionButton label={T.intro.get} onClick={onGetWallet} />
        <a className="wm-intro-link wm-touch wm-grow wm-shrink wm-t14b wm-accent" href={T.learnMoreUrl} target="_blank" rel="noreferrer">
          {T.learnMore}
        </a>
      </div>
    </div>
  );
}

function Feature({ art, title, body }: { art: string; title: string; body: string }) {
  return (
    <div className="wm-feature">
      <div className="wm-feature-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" draggable={false} />
      </div>
      <div className="wm-feature-text">
        <span className="wm-t14b">{title}</span>
        <span className="wm-t14m">{body}</span>
      </div>
    </div>
  );
}

/** RainbowKit's `GetDetail`: each wallet with what it offers and a GET that opens its download page. */
export function GetStep() {
  return (
    <div className="wm-get">
      <div className="wm-get-list">
        {KNOWN_WALLETS.map((wallet) => (
          <div key={wallet.name} className="wm-get-row">
            <div className="wm-get-who">
              <WalletIcon src={wallet.icon} size={48} />
              <div className="wm-get-names">
                <span className="wm-t14b">{wallet.name}</span>
                <span className="wm-t14m">{wallet.kind}</span>
              </div>
            </div>
            <ActionButton secondary label={T.get.action} href={wallet.href} />
          </div>
        ))}
      </div>
      <div className="wm-looking">
        <span className="wm-t14b">{T.get.lookingTitle}</span>
        <span className="wm-t14m">{T.get.lookingBody}</span>
      </div>
    </div>
  );
}

export type DetailWallet = { name: string; icon: string } & ({ installed: true } | { installed: false; href: string });

/**
 * RainbowKit's `ConnectDetail` for a browser wallet: "Opening X..." while the wallet asks for approval, RETRY once it
 * refused or failed; "X is not installed" with INSTALL for a wallet this browser doesn't have.
 */
export function ConnectStep({ wallet, failed, onRetry }: { wallet: DetailWallet; failed: boolean; onRetry: () => void }) {
  return (
    <div className="wm-detail">
      <div className="wm-detail-main">
        <div className="wm-detail-stack">
          <WalletIcon src={wallet.icon} size={44} ring={false} />
          <div className="wm-detail-text">
            <span className="wm-detail-title">{wallet.installed ? T.status.opening(wallet.name) : T.status.notInstalled(wallet.name)}</span>
            {wallet.installed ? (
              <>
                <span className="wm-t14m">{T.status.confirm}</span>
                <div className="wm-detail-status" aria-live="polite">
                  {failed ? <ActionButton label={T.status.retry} onClick={onRetry} /> : <Spinner />}
                </div>
              </>
            ) : (
              <div className="wm-detail-install">
                <ActionButton secondary label={T.status.install} href={wallet.href} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="wm-detail-foot" />
    </div>
  );
}
