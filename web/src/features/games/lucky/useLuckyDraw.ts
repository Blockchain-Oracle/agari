"use client";

import type { BookedOrder } from "@masayume/core/ports";
import type { Address, Bytes32, Hex } from "@masayume/core/types";
import { useCallback, useRef, useState } from "react";
import { deviceId } from "@/features/session/store";
import { isDealt, type DealtLuckyWire, type LuckyCommitWire, type LuckyDealWire, type LuckyPlacedStatus, type LuckyPlacedWire } from "./lucky-wire";

/**
 * One spin, from the tap to the row it leaves: the server's commitment first, then this browser's seed,
 * then the deal — and after the deal, whatever the Ticket lane came back as, reported so the row is
 * honest about it.
 *
 * The reels cycle from the tap. `committing` and `spinning` both keep them moving; the deal's arrival
 * starts the staggered stops, and only when the last reel has landed does the phase become `dealt` or
 * `refused`, which is when the card appears. Pips' reels do the same: the round trip hides inside the
 * spin, so a multi-second deal feels instant.
 */

export type LuckyPhase =
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "spinning"; commit: LuckyCommitWire; deal: LuckyDealWire | null }
  | { kind: "dealt"; deal: DealtLuckyWire }
  | { kind: "refused"; deal: LuckyDealWire }
  | { kind: "placed"; deal: DealtLuckyWire; placed: LuckyPlacedWire; booked: BookedOrder | null }
  | { kind: "failed"; message: string; deal: LuckyDealWire | null };

export interface LuckyDraw {
  phase: LuckyPhase;
  /** The reels keep moving through both round trips. */
  cycling: boolean;
  /** The deal is in hand; the reels may start stopping. */
  landing: boolean;
  target: LuckyDealWire["draw"] | null;
  spin: (wallet: Address, stakeBase: bigint) => Promise<void>;
  /** The last reel has stopped: the card may show. */
  landed: () => void;
  /** What the lane said, reported once; `booked` rides along for the placed plate. */
  report: (status: LuckyPlacedStatus, txHash: Hex | null, booked: BookedOrder | null) => Promise<void>;
  reset: () => void;
}

const ENDPOINT = "/api/games/lucky";

function randomSeed(): Bytes32 {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${ENDPOINT}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-masayume-device": deviceId() },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? `the server answered ${response.status}`);
  return json;
}

export function useLuckyDraw(): LuckyDraw {
  const [phase, setPhase] = useState<LuckyPhase>({ kind: "idle" });
  const inFlight = useRef(false);
  const reported = useRef<string | null>(null);

  const spin = useCallback(async (wallet: Address, stakeBase: bigint) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase({ kind: "committing" });
    try {
      const commit = await post<LuckyCommitWire>("commit", { wallet, stakeBase: stakeBase.toString() });
      setPhase({ kind: "spinning", commit, deal: null });
      // The browser's seed is chosen only now, after the commitment has been seen — that order is the proof.
      const deal = await post<LuckyDealWire>("reveal", { drawId: commit.drawId, clientSeed: randomSeed() });
      setPhase({ kind: "spinning", commit, deal });
    } catch (error) {
      setPhase({ kind: "failed", message: error instanceof Error ? error.message : String(error), deal: null });
    } finally {
      inFlight.current = false;
    }
  }, []);

  const landed = useCallback(() => {
    setPhase((current) => {
      if (current.kind !== "spinning" || !current.deal) return current;
      return isDealt(current.deal) ? { kind: "dealt", deal: current.deal } : { kind: "refused", deal: current.deal };
    });
  }, []);

  const report = useCallback(
    async (status: LuckyPlacedStatus, txHash: Hex | null, booked: BookedOrder | null) => {
      const deal = phase.kind === "dealt" ? phase.deal : null;
      if (!deal || reported.current === deal.drawId) return;
      reported.current = deal.drawId;
      try {
        const placed = await post<LuckyPlacedWire>("placed", { drawId: deal.drawId, status, ...(txHash ? { txHash } : {}) });
        setPhase({ kind: "placed", deal, placed, booked });
      } catch (error) {
        // The order is whatever the chain says it is; only the record of it failed. Say that, and keep the receipt on screen.
        setPhase({ kind: "failed", message: error instanceof Error ? error.message : String(error), deal });
      }
    },
    [phase],
  );

  const reset = useCallback(() => {
    reported.current = null;
    setPhase({ kind: "idle" });
  }, []);

  const deal = phase.kind === "spinning" ? phase.deal : "deal" in phase ? phase.deal : null;
  return {
    phase,
    cycling: phase.kind === "committing" || (phase.kind === "spinning" && phase.deal === null),
    landing: phase.kind === "spinning" && phase.deal !== null,
    target: deal?.draw ?? null,
    spin,
    landed,
    report,
    reset,
  };
}
