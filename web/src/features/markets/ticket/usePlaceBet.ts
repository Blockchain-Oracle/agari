"use client";

import { ownCentsOf } from "@agari/core/orders";
import type { OrderOutcome, OrderRequest, WritePhase } from "@agari/core/ports";
import type { Address, MarketId, Quote, Side, Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { invalidateAfterWrite, useSigner, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { PREOPEN, TICKET } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { recordBet } from "@/features/room/record-bet";
import { SIDE_WORD } from "../side-styles";

export interface PlaceBetState {
  phase: WritePhase;
  outcome: OrderOutcome | null;
  txHash: Signature | null;
  /** The Window the outcome is for: a requote is a price on that Book, never on the Window the ticket advanced to. */
  marketId: MarketId | null;
}

const IDLE: PlaceBetState = { phase: "composing", outcome: null, txHash: null, marketId: null };

function phaseOf(outcome: OrderOutcome): WritePhase {
  switch (outcome.status) {
    case "confirmed":
    case "resting":
    case "nothingFilled":
      return "confirmed";
    case "reverted":
      return "reverted";
    case "unknown":
      return "unknown";
    default:
      return "composing";
  }
}

function txHashOf(outcome: OrderOutcome): Signature | null {
  if (outcome.status === "confirmed") return outcome.booked.txHash;
  if (outcome.status === "resting") return outcome.rested.txHash;
  if ("txHash" in outcome) return outcome.txHash ?? null;
  return null;
}

export interface PlaceBetSigner {
  submitter: ReturnType<typeof useSubmitter>;
  wallet: Address | null;
}

/**
 * The write-path state machine for one bet; a second tap while one is in flight is absorbed, never doubled.
 * By default the user's own session signs; a route may hand in another signer (the session key for taps).
 */
export function usePlaceBet(signer?: PlaceBetSigner) {
  const userSubmitter = useSubmitter();
  const queryClient = useQueryClient();
  const user = useSigner();
  const submitter = signer ? signer.submitter : userSubmitter;
  const address = signer ? signer.wallet : user.address;
  const [state, setState] = useState<PlaceBetState>(IDLE);
  const inFlight = useRef(false);

  const place = useCallback(
    async (request: Omit<OrderRequest, "wallet">) => {
      if (inFlight.current || !submitter || !address) return;
      inFlight.current = true;
      setState({ phase: "submitted", outcome: null, txHash: null, marketId: request.market.marketId });
      try {
        const outcome = await submitter.submitOrder({ ...request, wallet: address }, (phase, detail) =>
          setState((s) => ({ ...s, phase, txHash: detail?.txHash ?? s.txHash })),
        );
        if (outcome.status === "confirmed" || outcome.status === "resting" || outcome.status === "nothingFilled") {
          // A delegated fill lands on the owner's books, not the key's — refresh the owner too.
          await invalidateAfterWrite(queryClient, { wallet: user.address ?? address, marketId: request.market.marketId });
          if (user.address && user.address !== address) await invalidateAfterWrite(queryClient, { wallet: address });
        }
        setState({ phase: phaseOf(outcome), outcome, txHash: txHashOf(outcome), marketId: request.market.marketId });
        if (outcome.status === "confirmed") {
          const { booked } = outcome;
          // The bet records the bettor, as the reference's does (`bet_registry::record` inside the bet PTB).
          recordBet(request.market.marketId, user.address ?? address, booked.txHash, request.route?.kind === "wallet" ? "wallet" : "vault");
          notify.neutral(TICKET.booked(formatBaseUnits(booked.contractsRaw, request.market.decimals, { minDp: 0 }), SIDE_WORD[booked.side], booked.avgPriceBps));
        }
        if (outcome.status === "resting") {
          // A scheduled call rests: nothing to record as a bet until it fills (the index's fill row does that).
          const { rested } = outcome;
          notify.neutral(PREOPEN.ticket.restingToast(formatBaseUnits(rested.contractsRaw, request.market.decimals, { minDp: 0 }), SIDE_WORD[rested.side], ownCentsOf(rested.side, rested.priceTicks)));
        }
      } finally {
        inFlight.current = false;
      }
    },
    [address, queryClient, submitter, user.address],
  );

  const reset = useCallback(() => setState(IDLE), []);
  /** The book's new price after a refused fill, while the ticket still asks for the same Window, side and stake; else null. */
  const requoteFor = useCallback(
    (marketId: MarketId, side: Side | null, stakeBase: bigint): Quote | null => {
      const outcome = state.outcome;
      if (outcome?.status !== "requote" || state.marketId !== marketId) return null;
      return outcome.quote.side === side && outcome.quote.stakeBase === stakeBase ? outcome.quote : null;
    },
    [state],
  );

  return { state, place, reset, requoteFor, placing: state.phase === "submitted" };
}
