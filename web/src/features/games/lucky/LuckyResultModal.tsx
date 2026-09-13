"use client";

import { formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Hash } from "@/components/data";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useModalSfx } from "../audio";
import { LUCKY } from "./copy";
import type { LuckyRowWire } from "./lucky-wire";
import "../duel/duel.css";

/**
 * The verdict, the moment it lands — Pips' LuckyResult (YOU WON / MISSED over a flat wash) in the duel's
 * result-modal grammar. It says only what the chain decided: the side, the reach, what the held
 * contracts pay before the fee on a win, what was staked on a miss, that a void pays both sides their
 * half, that a cash-out closed on the book. The streak chip shows only on a win, and only the number
 * the verified history adds up to. Closed by the scrim, the ✕ or Escape; it never re-spins.
 */
export function LuckyResultModal({ open, onClose, row, decimals, symbol, streak }: { open: boolean; onClose: () => void; row: LuckyRowWire; decimals: number | null; symbol: string; streak: number }) {
  useModalSfx(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const words = LUCKY.result;
  const won = row.result === "won";
  const lost = row.result === "lost";
  const tone = won ? " du-modal--won" : lost ? " du-modal--lost" : "";
  const verdict = won ? words.won : lost ? words.lost : row.result === "void" ? words.void : words.cashedOut;
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));
  const line = won ? words.pays(money(row.quantityRaw), symbol) : lost ? words.lostLine(money(row.costBase), symbol) : row.result === "void" ? words.voidLine : words.cashedLine;

  return createPortal(
    <div className="du-modal-root" role="dialog" aria-modal="true" aria-labelledby="lk-modal-title" onClick={onClose}>
      <div className={`du-modal${tone}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="du-modal-close" onClick={onClose} aria-label={words.close}>
          ✕
        </button>
        <span className="gm-eyebrow">{words.eyebrow}</span>
        <h2 id="lk-modal-title" className="du-modal-verdict">
          {verdict}
        </h2>
        <p className="du-modal-stat-v du-modal-stat-v--soft">{row.asset && row.side && row.multiplier ? words.line(row.asset, SIDE_WORD[row.side], row.multiplier) : ""}</p>
        <p className="lk-plate-body">{line}</p>
        {won && streak > 0 && <p className="du-season-line">{words.streak(streak)}</p>}
        <div className="lk-row-links">
          {row.txHash && (
            <span className="lk-plate-foot">
              {LUCKY.placed.tx} <Hash value={row.txHash} href={txUrl(row.txHash)} />
            </span>
          )}
          {won && (
            <Link href="/portfolio" className="lk-link" onClick={onClose}>
              {words.claim}
            </Link>
          )}
        </div>
        <button type="button" className="du-cta du-cta--quiet" onClick={onClose}>
          {words.close}
        </button>
      </div>
    </div>,
    document.body,
  );
}
