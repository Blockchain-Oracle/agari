"use client";

import type { BookedOrder } from "@masayume/core/ports";
import { bpsToOddsCents, formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import Link from "next/link";
import { Hash } from "@/components/data";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { LUCKY } from "./copy";
import type { DealtLuckyWire, LuckyDealWire, LuckyPlacedWire } from "./lucky-wire";

/**
 * What the machine says after the tap, or instead of a card: placed (pending its Window), sent with no
 * receipt, refused for a named reason, or a request that failed before anything was drawn. Every plate
 * carries a way to spin again, and a placed one links the transaction and the portfolio — the position
 * is the venue's, and it is looked after there.
 */

interface AgainProps {
  onAgain: () => void;
}

export function LuckyPlacedPlate({ deal, placed, booked, symbol, onAgain }: AgainProps & { deal: DealtLuckyWire; placed: LuckyPlacedWire; booked: BookedOrder | null; symbol: string }) {
  // The Window's own decimals, carried on the deal from the chain read — never a guessed six.
  const dp = deal.window.decimals;
  const words = LUCKY.placed;
  const refused = placed.result === "refused";
  const unknown = placed.result === "unknown";
  const title = refused ? LUCKY.refused.title : unknown ? words.unknownTitle : words.title;
  return (
    <section className={`lk-plate ${refused ? "lk-plate--refused" : "lk-plate--placed"}`} aria-label={title} role="status">
      <h2 className="lk-plate-title">{title}</h2>
      {booked && <p className="lk-plate-body">{words.booked(formatBaseUnits(booked.contractsRaw, dp, { minDp: 0, maxDp: 2 }), SIDE_WORD[booked.side], bpsToOddsCents(booked.avgPriceBps))}</p>}
      {refused ? (
        <p className="lk-plate-body">{refusalText(placed.refusal, deal)}</p>
      ) : unknown ? (
        <p className="lk-plate-body">{words.unknown}</p>
      ) : (
        <>
          <p className="lk-plate-body">{placed.costBase && placed.quantityRaw ? words.measured(formatBaseUnits(BigInt(placed.quantityRaw), dp, { minDp: 0, maxDp: 2 }), formatBaseUnits(BigInt(placed.costBase), dp), symbol) : words.notOnTape}</p>
          <p className="lk-plate-body">{words.pending}</p>
        </>
      )}
      <div className="lk-row-links">
        {placed.txHash && (
          <span className="lk-plate-foot">
            {words.tx} <Hash value={placed.txHash} href={txUrl(placed.txHash)} />
          </span>
        )}
        {!refused && (
          <Link href="/portfolio" className="lk-link">
            {words.portfolio}
          </Link>
        )}
        <button type="button" className="lk-link" onClick={onAgain}>
          {LUCKY.spin.again}
        </button>
      </div>
    </section>
  );
}

function refusalText(refusal: string | null, deal: LuckyDealWire): string {
  const words = LUCKY.refused;
  switch (refusal) {
    case "no-window":
      return words.noWindow(deal.draw.asset, SIDE_WORD[deal.draw.side], deal.draw.multiplier);
    case "venue-unreadable":
      return words.unreadable;
    case "declined":
      return words.declined;
    case "nothing-filled":
      return words.nothingFilled;
    case "reverted":
      return words.reverted;
    case "lane-refused":
      return words.laneRefused;
    default:
      return words.laneRefused;
  }
}

/** The scan dealt nothing: the draw stands and is shown on the reels; the reason is named. */
export function LuckyRefusedPlate({ deal, onAgain }: AgainProps & { deal: LuckyDealWire }) {
  return (
    <section className="lk-plate lk-plate--refused" aria-label={LUCKY.refused.title} role="status">
      <h2 className="lk-plate-title">{LUCKY.refused.title}</h2>
      <p className="lk-plate-body">{refusalText(deal.refusal, deal)}</p>
      <p className="lk-plate-foot">{LUCKY.deal.proof.nonce(deal.nonce, deal.policyVersion)}</p>
      <div className="lk-row-links">
        <button type="button" className="lk-link" onClick={onAgain}>
          {LUCKY.spin.again}
        </button>
      </div>
    </section>
  );
}

/** A request that did not come back. Nothing was drawn, or the order stands and only its record failed — the message says which. */
export function LuckyFailedPlate({ message, hadDeal, onAgain }: AgainProps & { message: string; hadDeal: boolean }) {
  return (
    <section className="lk-plate lk-plate--refused" aria-label={LUCKY.refused.title} role="alert">
      <h2 className="lk-plate-title">{hadDeal ? LUCKY.placed.unknownTitle : LUCKY.refused.title}</h2>
      <p className="lk-plate-body">{LUCKY.spin.failed(message)}</p>
      {hadDeal && <p className="lk-plate-body">{LUCKY.placed.unknown}</p>}
      <div className="lk-row-links">
        {hadDeal && (
          <Link href="/portfolio" className="lk-link">
            {LUCKY.placed.portfolio}
          </Link>
        )}
        <button type="button" className="lk-link" onClick={onAgain}>
          {LUCKY.spin.again}
        </button>
      </div>
    </section>
  );
}
