"use client";

import type { Hex } from "@masayume/core/types";
import { txUrl } from "@masayume/core/urls";
import Link from "next/link";
import { RANGE } from "./copy";

/** The ticket's body once a band is on chain: the receipt line, the transaction, the rounds page, "another". */
export function RangePlaced({ placed, onAnother }: { placed: { txHash: Hex; band: string }; onAnother: () => void }) {
  return (
    <div className="flex flex-col gap-3" role="status">
      <p className="type-body text-ink">{RANGE.cta.placed(placed.band)}</p>
      <a href={txUrl(placed.txHash)} target="_blank" rel="noopener noreferrer" className="type-caption text-ink-secondary underline">
        {RANGE.ticket.viewTx}
      </a>
      <div className="flex items-center justify-between gap-3">
        <Link href="/games/range" className="type-caption text-vermilion underline">
          {RANGE.cta.rounds}
        </Link>
        <button type="button" onClick={onAnother} className="type-caption text-ink-secondary underline" data-cursor="hover">
          {RANGE.cta.another}
        </button>
      </div>
    </div>
  );
}
