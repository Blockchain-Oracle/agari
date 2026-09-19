/**
 * What the cover card shows (plan Step 2, 2026-09-19). The old card rendered nothing in every case but the offer, which
 * made the feature indistinguishable from one that was never built. Pure, so the live card and `/dev/hedge` agree.
 */
import type { Reading } from "@agari/core";
import type { HedgePick } from "./hedge-target";
import type { HoldingView } from "./useHoldings";

export type HedgeCardState =
  | { kind: "no-wallet" }
  | { kind: "reading" }
  | { kind: "unreadable" }
  | { kind: "no-holding" }
  /** A verified holding with no Window of its underlying trading right now; `lead` is the largest. */
  | { kind: "no-window"; lead: HoldingView }
  | { kind: "offer"; pick: HedgePick };

export function hedgeCardState(input: {
  address: string | null;
  holdings: Reading<HoldingView[]> | null;
  pick: HedgePick | null;
  /** False on the first client paint (`nowMs === 0`), when no Window can be judged yet. */
  clockReady: boolean;
}): HedgeCardState {
  const { address, holdings, pick, clockReady } = input;
  if (address === null) return { kind: "no-wallet" };
  if (holdings === null || !clockReady) return { kind: "reading" };
  if (!holdings.ok) return { kind: "unreadable" };
  if (pick) return { kind: "offer", pick };
  const lead = holdings.value[0];
  return lead ? { kind: "no-window", lead } : { kind: "no-holding" };
}
