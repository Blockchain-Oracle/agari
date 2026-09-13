import type { BlockerKind } from "@masayume/core/copy";
import type { PrivateQuote } from "@masayume/core/private";
import type { Diagnosis } from "@masayume/core/types";
import { commonBlocker, type TicketBlockerInput } from "../markets/ticket/ticket-guards";

export interface PrivateGuardInput {
  deployed: boolean;
  probing: boolean;
  ready: boolean;
  minStakeBase: bigint | null;
  maxStakeBase: bigint | null;
  budgetReadable: boolean;
  /** Stake minus what the private balance can spend, floored at zero; a top-up covers it from the wallet. */
  shortBase: bigint;
  walletCanCover: boolean;
  quote: PrivateQuote | null;
  quoteLoading: boolean;
  quoteError: Diagnosis | null;
}

/**
 * The reference's `privBlocker` (`Ticket624Drawer.tsx` L439–448): a private bet uses none of the trading
 * account, so none of the wallet-funding or public-quote conditions apply — the common ladder without the
 * funds checks, then the private route's own reasons in the order the user can fix them.
 */
export function derivePrivateBlocker(i: TicketBlockerInput, p: PrivateGuardInput): BlockerKind | null {
  const common = commonBlocker({ ...i, availableBase: null, funding: null });
  if (common) return common;
  if (!p.deployed) return "private-unavailable";
  if (p.probing) return "private-probing";
  if (!p.ready) return "private-unavailable";
  if (p.minStakeBase !== null && i.stakeBase < p.minStakeBase) return "private-below-min";
  if (p.maxStakeBase !== null && i.stakeBase > p.maxStakeBase) return "private-over-cap";
  if (!p.budgetReadable) return "private-unreadable";
  if (p.shortBase > 0n && !p.walletCanCover) return "over-balance";
  if (p.quoteError) return "private-refused";
  if (p.quoteLoading || !p.quote) return "quoting";
  return null;
}
