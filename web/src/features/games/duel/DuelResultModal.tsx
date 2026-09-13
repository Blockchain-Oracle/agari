"use client";

import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useShareCard } from "@/features/share/useShareCard";
import { addressHue } from "@/lib/address-hue";
import { useModalSfx } from "../audio";
import { DUEL } from "./copy";
import { duelCardId, duelShareUrl, renderDuelShareCard, type DuelCard } from "./duel-card";

/**
 * Flicky's result modal (`duel-result-modal.tsx` L148–231), in Yosuku's tokens: the verdict at 4xl
 * tracked upper-case, the return at 5xl, two 64px seats around "vs", three figures, `share image`
 * and `copy link`. It opens itself once when the verdict lands, with the verdict's own sound (the
 * effect lives beside the verdict in DuelResult, where the state is), closes on the scrim, the ✕ or
 * Escape, and locks the page's scroll while it is up. The share renders the card off-screen to a PNG
 * and hands it to the native sheet, or saves it — the app's one share flow.
 */
export function DuelResultModal({ open, onClose, card }: { open: boolean; onClose: () => void; card: DuelCard }) {
  const words = DUEL.result.modal;
  const [copied, setCopied] = useState(false);
  const { busy, share } = useShareCard();
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

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!open || typeof document === "undefined") return null;

  const tone = card.verdict === "won" ? " du-modal--won" : card.verdict === "lost" ? " du-modal--lost" : "";
  const returnText = card.returnPct === null ? null : `${card.returnPct > 0 ? "+" : ""}${card.returnPct}%`;
  const money = (base: bigint) => formatBaseUnits(base, card.decimals, { maxDp: 2, minDp: 2 });
  const url = duelShareUrl(card.matchId);

  const onCopy = () => {
    try {
      void navigator.clipboard
        ?.writeText(url)
        .then(() => setCopied(true))
        .catch(() => undefined);
    } catch {
      // clipboard unavailable — enhancement only
    }
  };

  return createPortal(
    <div className="du-modal-root" role="dialog" aria-modal="true" aria-labelledby="du-modal-title" onClick={onClose}>
      <div className={`du-modal${tone}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="du-modal-close" onClick={onClose} aria-label={words.close}>
          ✕
        </button>
        <h2 id="du-modal-title" className="du-modal-verdict">
          {words.verdict[card.verdict]}
        </h2>
        {returnText && <p className="du-modal-return">{returnText}</p>}

        <div className="du-modal-seats">
          <span className="du-avatar du-avatar--lg" style={{ "--du-hue": card.you ? addressHue(card.you) : 0 } as CSSProperties} aria-label={card.you ? shortHex(card.you, 6, 4) : undefined} />
          <span className="du-modal-vs">vs</span>
          <span className="du-avatar du-avatar--lg" style={{ "--du-hue": card.opponent ? addressHue(card.opponent) : 0 } as CSSProperties} aria-label={card.opponent ? shortHex(card.opponent, 6, 4) : undefined} />
        </div>

        <div className="du-modal-stats">
          <Stat value={`${card.hits}/${card.total}`} label={words.hits} />
          {card.free ? (
            <div className="du-modal-stat du-modal-stat--wide">
              <span className="du-modal-stat-v du-modal-stat-v--soft">{words.free}</span>
            </div>
          ) : (
            <>
              <Stat value={card.pnlBase === null ? "—" : `${card.pnlBase > 0n ? "+" : card.pnlBase < 0n ? "−" : ""}${money(card.pnlBase < 0n ? -card.pnlBase : card.pnlBase)}`} label={words.pnl} />
              <Stat value={card.potAwardedBase === null ? "—" : money(card.potAwardedBase)} label={words.pot} />
            </>
          )}
        </div>

        <div className="du-modal-actions">
          <button
            type="button"
            className="du-cta"
            disabled={busy}
            onClick={() => void share({ render: () => renderDuelShareCard(card), fileName: `masayume-duel-${duelCardId(card)}.png`, text: words.shareText(card.verdict, returnText, url) })}
          >
            {busy ? words.sharing : words.share}
          </button>
          <button type="button" className="du-cta du-cta--quiet" onClick={onCopy}>
            {copied ? words.copied : words.copy}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="du-modal-stat">
      <span className="du-modal-stat-v">{value}</span>
      <span className="du-modal-stat-k">{label}</span>
    </div>
  );
}
