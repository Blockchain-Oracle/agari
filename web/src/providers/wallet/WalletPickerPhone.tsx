"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { KNOWN_WALLETS, WALLET_MODAL } from "./copy";
import type { DiscoveredWallet, WalletChoices } from "./useWalletChoices";
import { ActionButton, BackButton, CloseButton, Spinner, WalletIcon } from "./wallet-modal-parts";

const T = WALLET_MODAL;

/**
 * RainbowKit's `MobileOptions` in its bottom sheet: the installed wallets as a strip of app icons, the "What is a
 * Wallet?" paragraph with Get a Wallet / Learn More, and a Get step listing where to download one.
 */
export function WalletPickerPhone({ choices, close }: { choices: WalletChoices; close: () => void }) {
  const [step, setStep] = useState<"connect" | "get">("connect");
  const [connecting, setConnecting] = useState<string | null>(null);

  async function choose(wallet: DiscoveredWallet) {
    setConnecting(wallet.name);
    const outcome = await choices.connect(wallet);
    setConnecting(null);
    if (outcome === "connected") close();
  }

  return (
    <div className="wm-mobile">
      <div className="wm-m-head">
        <div className="wm-m-head-row">
          {step === "get" && (
            <div className="wm-m-back">
              <BackButton onClick={() => setStep("connect")} />
            </div>
          )}
          <Dialog.Title render={<h1 />} className="wm-m-title">
            {step === "get" ? T.get.title : T.title}
          </Dialog.Title>
          <div className="wm-m-close">
            <div>
              <CloseButton phone />
            </div>
          </div>
        </div>
      </div>

      {step === "connect" ? (
        <div>
          <div className="wm-m-strip">
            {choices.installed.map(({ wallet, recent }) => (
              <button key={wallet.name} type="button" className="wm-m-tile" onClick={() => void choose(wallet)} disabled={connecting !== null}>
                <span className="wm-m-tile-art">
                  {connecting === wallet.name && <Spinner />}
                  <WalletIcon src={wallet.icon} size={60} ring={false} />
                </span>
                {connecting !== wallet.name && (
                  <>
                    <span className="wm-m-tile-name">{wallet.name}</span>
                    {recent && <span className="wm-recent">{T.recent}</span>}
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="wm-m-divider" />
          <div className="wm-m-intro">
            <span className="wm-m-intro-title">{T.intro.title}</span>
            <span className="wm-m-intro-body">{T.intro.description}</span>
          </div>
          <div className="wm-m-actions">
            <ActionButton secondary size="large" label={T.intro.get} onClick={() => setStep("get")} />
            <ActionButton secondary size="large" label={T.learnMore} href={T.learnMoreUrl} />
          </div>
        </div>
      ) : (
        <div>
          <div className="wm-m-get">
            {KNOWN_WALLETS.map((wallet, index) => (
              <div key={wallet.name} className="wm-m-get-row">
                <WalletIcon src={wallet.icon} size={48} />
                <div className="wm-m-get-main">
                  <div className="wm-m-get-line">
                    <span className="wm-m-get-name">{wallet.name}</span>
                    <ActionButton secondary size="small" label={T.get.action} href={wallet.href} />
                  </div>
                  {index < KNOWN_WALLETS.length - 1 && <div className="wm-m-get-sep" />}
                </div>
              </div>
            ))}
          </div>
          <div className="wm-m-looking">
            <span className="wm-m-intro-title">{T.get.lookingTitle}</span>
            <span className="wm-m-intro-body">{T.get.lookingBody}</span>
          </div>
        </div>
      )}
    </div>
  );
}
