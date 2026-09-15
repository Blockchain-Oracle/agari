"use client";

import { FAUCET_UNITS, SOL_FAUCETS } from "@agari/core/constants";
import { collateralOrNull } from "@agari/markets";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TUsdcMark } from "@/components/icons/AssetMarks";
import { useFaucet } from "@/features/markets/faucet";
import { ConnectButton } from "@/features/markets/wallet";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FUNDING } from "./copy";
import "./funding.css";
import { FundingProgress } from "./FundingProgress";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/** Shared test-funds dialog: eligible devnet SOL top-up, then the server-sent tUSDC mint, behind one free signature (D-034). */
export function AddFunds({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, isRightChain } = useWalletSession();
  const faucet = useFaucet();
  const [copied, setCopied] = useState(false);
  const symbol = collateralOrNull()?.symbol ?? "tUSDC";
  const amountText = String(FAUCET_UNITS);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;
  const minting = faucet.busy;
  const done = faucet.state.phase === "confirmed";
  const diagnosis = faucet.state.diagnosis;

  return (
    <div className="fund-modal-root">
      <button type="button" className="fund-modal-scrim" aria-label={FUNDING.modal.close} tabIndex={-1} onClick={onClose} />
      <div className="fund-modal" role="dialog" aria-modal="true" aria-labelledby="add-funds-title">
        <button type="button" onClick={onClose} aria-label={FUNDING.modal.close} className="fund-modal-close" data-cursor="hover">
          <X className="h-4 w-4" />
        </button>

        <div className="fund-eyebrow-row">
          <span className="fund-eyebrow-dot" />
          <span className="fund-eyebrow">{FUNDING.modal.eyebrow}</span>
        </div>
        <h2 id="add-funds-title" className="fund-title">
          {FUNDING.modal.title}
        </h2>
        <p className="fund-body">{FUNDING.modal.body}</p>

        {!address ? (
          <div className="fund-connect-first"><p>{FUNDING.modal.connectFirst}</p><ConnectButton /></div>
        ) : (
          <>
            <div className="fund-account">
              <span className="fund-account-label">{FUNDING.modal.account}</span>
              <button
                type="button"
                className="fund-account-addr"
                aria-label="Copy account address"
                onClick={() => {
                  void navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                data-cursor="hover"
              >
                {copied ? FUNDING.modal.copied : `${short(address)} ⧉`}
              </button>
            </div>

            <FundingProgress address={address} faucet={faucet} />
            {!isRightChain && <ConnectButton />}

            {done ? (
              <Link href="/markets" onClick={onClose} className="fund-cta-vermilion" data-cursor="hover">
                {FUNDING.modal.trade}
              </Link>
            ) : (
              <div className="fund-rows">
                <p className="fund-foot-line">{FUNDING.modal.sequence(FAUCET_UNITS.toLocaleString("en-US"), symbol)}</p>
                <button type="button" onClick={() => void faucet.mint()} disabled={minting || !faucet.hasSigner} className="fund-cta-white" data-cursor="hover">
                  <TUsdcMark className="fund-cta-mark" />
                  {minting ? faucet.label : FUNDING.modal.request(amountText, symbol)}
                </button>
              </div>
            )}

            {done && <p className="fund-msg fund-msg--ok">{FUNDING.modal.done(amountText, symbol)}</p>}
            {done && <button type="button" className="fund-foot-link" onClick={faucet.resetCompleted}>Get more test funds</button>}
            {diagnosis && !done && <p className="fund-msg fund-msg--err">{diagnosisCopy(diagnosis.kind).headline}</p>}

            <div className="fund-foot">
              {faucet.state.gasShort && <p className="fund-foot-line">{FUNDING.modal.gasFirst}</p>}
              {SOL_FAUCETS.map((f) => (
                <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="fund-foot-link" data-cursor="hover">
                  {faucet.state.gasShort ? `${f.name} ↗` : FUNDING.modal.needMore}
                </a>
              )).slice(0, faucet.state.gasShort ? SOL_FAUCETS.length : 1)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
