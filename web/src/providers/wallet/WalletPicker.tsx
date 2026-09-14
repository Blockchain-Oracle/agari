"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WALLET_MODAL, type KnownWallet } from "./copy";
import { useWalletChoices, type DiscoveredWallet, type WalletChoices } from "./useWalletChoices";
import { BackButton, CloseButton, usePhoneLayout, WalletDialog, WalletIcon } from "./wallet-modal-parts";
import { WalletPickerPhone } from "./WalletPickerPhone";
import { ConnectStep, GetStep, IntroStep } from "./wallet-steps";

const T = WALLET_MODAL;

type Step =
  | { kind: "list" }
  | { kind: "learn" }
  | { kind: "get" }
  | { kind: "connect"; wallet: DiscoveredWallet; failed: boolean }
  | { kind: "install"; wallet: KnownWallet };

/**
 * The connect modal (D-023 behaviour, Masayume's look): RainbowKit's compact modal as Masayume configured it, listing
 * the Wallet Standard wallets this browser has. It unmounts on close, so every open starts at the list.
 */
export function WalletPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <WalletDialog open={open} onOpenChange={onOpenChange} compact>
      <PickerBody close={() => onOpenChange(false)} />
    </WalletDialog>
  );
}

function PickerBody({ close }: { close: () => void }) {
  const phone = usePhoneLayout();
  const choices = useWalletChoices();
  return phone ? <WalletPickerPhone choices={choices} close={close} /> : <CompactOptions choices={choices} close={close} />;
}

function CompactOptions({ choices, close }: { choices: WalletChoices; close: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "list" });

  async function choose(wallet: DiscoveredWallet) {
    setStep({ kind: "connect", wallet, failed: false });
    const outcome = await choices.connect(wallet);
    if (outcome === "connected") close();
    else if (outcome === "failed") setStep((now) => (now.kind === "connect" && now.wallet === wallet ? { ...now, failed: true } : now));
  }

  if (step.kind === "list") {
    return (
      <div className="wm-options">
        <WalletList choices={choices} onChoose={(wallet) => void choose(wallet)} onInstall={(wallet) => setStep({ kind: "install", wallet })} onLearn={() => setStep({ kind: "learn" })} />
      </div>
    );
  }

  const toList = () => setStep({ kind: "list" });
  const header =
    step.kind === "learn" ? { label: T.intro.title, back: toList }
    : step.kind === "get" ? { label: T.get.title, back: () => setStep({ kind: "learn" }) }
    : { label: null, back: toList };

  return (
    <div className="wm-options">
      <div className="wm-step">
        <div className="wm-step-head">
          <div className="wm-step-head-side">
            <BackButton onClick={header.back} />
          </div>
          <div className="wm-step-title">
            <Dialog.Title className={cn("wm-t18", !header.label && "sr-only")}>{header.label ?? T.title}</Dialog.Title>
          </div>
          <CloseButton />
        </div>
        <div className="wm-step-body">
          <div className="wm-step-inner">
            {step.kind === "learn" && <IntroStep onGetWallet={() => setStep({ kind: "get" })} />}
            {step.kind === "get" && <GetStep />}
            {step.kind === "connect" && (
              <ConnectStep
                wallet={{ name: step.wallet.name, icon: step.wallet.icon, installed: true }}
                failed={step.failed}
                onRetry={() => void choose(step.wallet)}
              />
            )}
            {step.kind === "install" && (
              <ConnectStep wallet={{ ...step.wallet, installed: false }} failed={false} onRetry={() => undefined} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** RainbowKit's compact `DesktopOptions` first screen: title, grouped wallet rows, and the "New to … wallets?" footer. */
function WalletList({
  choices,
  onChoose,
  onInstall,
  onLearn,
}: {
  choices: WalletChoices;
  onChoose: (wallet: DiscoveredWallet) => void;
  onInstall: (wallet: KnownWallet) => void;
  onLearn: () => void;
}) {
  return (
    <div className="wm-list-col">
      <div className="wm-list-head">
        <div className="wm-list-head-spacer" />
        <div className="wm-list-title">
          <Dialog.Title render={<h1 />} className="wm-t18">
            {T.title}
          </Dialog.Title>
        </div>
        <div className="wm-list-close">
          <CloseButton />
        </div>
      </div>
      <div className="wm-scroll">
        {choices.installed.length > 0 && (
          <Group name={T.groups.installed} accent>
            {choices.installed.map(({ wallet, recent }) => (
              <WalletRow key={wallet.name} icon={wallet.icon} name={wallet.name} recent={recent} onClick={() => onChoose(wallet)} />
            ))}
          </Group>
        )}
        {choices.browser.length > 0 && (
          <Group name={T.groups.browser}>
            {choices.browser.map((wallet) => (
              <WalletRow key={wallet.name} icon={wallet.icon} name={wallet.name} recent={false} onClick={() => onInstall(wallet)} />
            ))}
          </Group>
        )}
      </div>
      <div className="wm-divider" />
      <div className="wm-foot">
        <div className="wm-foot-text">
          <span className="wm-t14m">{T.newTo}</span>
        </div>
        <button type="button" className="wm-link wm-touch wm-grow wm-shrink wm-t14b wm-accent" onClick={onLearn}>
          {T.learnMore}
        </button>
      </div>
    </div>
  );
}

function Group({ name, accent = false, children }: { name: string; accent?: boolean; children: ReactNode }) {
  return (
    <>
      <div className="wm-group">
        <span className={cn("wm-t14b", accent ? "wm-accent" : "wm-group-muted")}>{name}</span>
      </div>
      <div className="wm-rows">{children}</div>
    </>
  );
}

function WalletRow({ icon, name, recent, onClick }: { icon: string; name: string; recent: boolean; onClick: () => void }) {
  return (
    <button type="button" className="wm-row wm-touch wm-shrink" onClick={onClick}>
      <span className="wm-row-inner">
        <WalletIcon src={icon} size={28} />
        <span>
          <span className={cn("wm-row-name", recent && "wm-row-name--recent")}>{name}</span>
          {recent && <span className="wm-recent">{T.recent}</span>}
        </span>
      </span>
    </button>
  );
}
