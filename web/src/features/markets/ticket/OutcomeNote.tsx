"use client";

import type { Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import type { ReactNode } from "react";
import { Hash, Money, Odds } from "@/components/data";
import { ErrorState } from "@/components/states";
import { SUBMITTED_UNKNOWN, TICKET } from "@/lib/copy";
import { SIDE_WORD } from "../side-styles";
import type { PlaceBetState } from "./usePlaceBet";

interface OutcomeNoteProps {
  state: PlaceBetState;
  decimals: number;
  symbol: string;
  onDismiss: () => void;
}

function formatContracts(contractsRaw: bigint, decimals: number): string {
  return formatBaseUnits(contractsRaw, decimals, { minDp: 0 });
}

function Line({ children, txHash }: { children: ReactNode; txHash?: Hex | null }) {
  return (
    <p role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2 type-caption text-ink">
      <span>{children}</span>
      {txHash && (
        <span className="text-ink-secondary">
          {TICKET.txLabel} <Hash value={txHash} href={txUrl(txHash)} className="text-ink" />
        </span>
      )}
    </p>
  );
}

/** Confirmed state comes from the actual receipt and fills; a revert is never shown as success (FR-9). */
export function OutcomeNote({ state, decimals, symbol, onDismiss }: OutcomeNoteProps) {
  const { outcome, txHash } = state;
  if (state.phase === "unknown") return <Line txHash={txHash}>{SUBMITTED_UNKNOWN}</Line>;
  if (!outcome) return null;

  switch (outcome.status) {
    case "confirmed": {
      const { booked } = outcome;
      return (
        <Line txHash={booked.txHash}>
          {TICKET.bookedPrefix} <span className="numbers">{formatContracts(booked.contractsRaw, decimals)}</span> {SIDE_WORD[booked.side]} {TICKET.bookedAt}{" "}
          <Odds bps={booked.avgPriceBps} /> · <Money value={booked.costBase} decimals={decimals} symbol={symbol} />
        </Line>
      );
    }
    case "nothingFilled":
      return <Line txHash={outcome.txHash}>{TICKET.nothingFilled}</Line>;
    case "requote":
      return (
        <Line>
          {TICKET.requotePrefix} <Money value={outcome.quote.maxCostBase} decimals={decimals} symbol={symbol} /> {TICKET.requoteSuffix}
        </Line>
      );
    case "reverted":
      return <ErrorState diagnosis={outcome.diagnosis} retry={onDismiss} />;
    case "refused":
      return <ErrorState diagnosis={outcome.diagnosis} retry={onDismiss} />;
    case "unknown":
      return <Line txHash={outcome.txHash ?? null}>{SUBMITTED_UNKNOWN}</Line>;
  }
}
