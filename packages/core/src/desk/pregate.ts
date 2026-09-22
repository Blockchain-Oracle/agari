/**
 * Hard blockers, decided by code BEFORE the model is asked anything (desk.md §8, the eleven rules). Each one names its
 * rule, so the record says exactly why the desk will not touch a name. A blocked candidate costs no model call. The
 * desk does not act on facts it cannot verify: an unknown pause flag or an unknown freeze blocks.
 */
import { deskCopy } from "./copy";
import { nameOf } from "./mandate";
import { MAX_ROUTE_ACCOUNTS, MOVING_FAST_BPS, REFERENCE_MAX_AGE_SEC, type DeskMarketRead } from "./market";
import type { DeskCandidate } from "./needs";

export const BLOCKER_RULES = [
  "DESK_NOT_ACTIVE",
  "TOKEN_NOT_ALLOWED",
  "REFERENCE_UNAVAILABLE",
  "PREMIUM_TOO_HIGH",
  "QUOTE_UNAVAILABLE",
  "BEYOND_PRICE_BAND",
  "PRICE_MOVING_FAST",
  "MINT_PAUSED",
  "ACCOUNT_FROZEN",
  "ROUTE_TOO_LARGE",
  "DID_THIS_MINUTES_AGO",
] as const;
export type BlockerRule = (typeof BLOCKER_RULES)[number];

export interface Blocker {
  rule: BlockerRule;
  text: string;
}

export interface PregateInput {
  candidate: DeskCandidate;
  market: DeskMarketRead;
  deskActive: boolean;
  deskStateText: string;
  /** How the owner configured this name on the desk (`Desk.tokens`). */
  onChain: { configured: boolean; enabled: boolean };
  /** The premium reference the gate will use (mark, or Pyth's index when required), and the owner's ceiling. */
  premiumBps: number | null;
  maxPremiumBps: number;
  /** The quote is beyond the program's 8 % band, as the gate worked out. */
  beyondBand: boolean;
  /** The desk already did this same thing to this same name a few minutes ago. */
  repeatedWithinMinutes: boolean;
  maxRouteAccounts?: number;
}

export function pregate(input: PregateInput): Blocker[] {
  const { market: m, candidate: c } = input;
  const name = nameOf(c.symbol);
  const blockers: Blocker[] = [];
  const block = (rule: BlockerRule, text: string) => blockers.push({ rule, text });
  const copy = deskCopy.blocker;
  const maxAccounts = input.maxRouteAccounts ?? MAX_ROUTE_ACCOUNTS;

  if (!input.deskActive) block("DESK_NOT_ACTIVE", copy.deskNotActive(input.deskStateText));
  if (!input.onChain.configured || (c.side === "buy" && !input.onChain.enabled)) block("TOKEN_NOT_ALLOWED", copy.tokenNotAllowed(name));
  if (m.spotE8 <= 0n || m.referenceAgeSec === null || m.referenceAgeSec > REFERENCE_MAX_AGE_SEC) block("REFERENCE_UNAVAILABLE", copy.referenceUnavailable(name));
  if (c.side === "buy") {
    // The program measures the premium on every buy; without a reference it cannot, and neither can the desk.
    if (input.premiumBps === null) block("REFERENCE_UNAVAILABLE", copy.referenceUnavailable(name));
    else if (input.premiumBps > input.maxPremiumBps) block("PREMIUM_TOO_HIGH", copy.premiumTooHigh(name, input.premiumBps, input.maxPremiumBps));
  }
  if (m.quoteOut === null || m.quoteOut <= 0n) block("QUOTE_UNAVAILABLE", copy.quoteUnavailable(name));
  if (input.beyondBand) block("BEYOND_PRICE_BAND", copy.beyondPriceBand(name));
  if (m.movingBps >= MOVING_FAST_BPS) block("PRICE_MOVING_FAST", copy.movingFast(name, m.movingBps));
  if (m.mintPaused === null) block("MINT_PAUSED", copy.mintPauseUnknown(name));
  else if (m.mintPaused) block("MINT_PAUSED", copy.mintPaused(name));
  if (m.accountFrozen !== false) block("ACCOUNT_FROZEN", copy.accountFrozen(name));
  if (m.routeAccounts !== null && m.routeAccounts > maxAccounts) block("ROUTE_TOO_LARGE", copy.routeTooLarge(name, m.routeAccounts, maxAccounts));
  if (input.repeatedWithinMinutes) block("DID_THIS_MINUTES_AGO", copy.didThisMinutesAgo(name));
  // One entry per rule: the reference rule can fire twice on a buy, and the record lists each rule once.
  return blockers.filter((b, i) => blockers.findIndex((x) => x.rule === b.rule) === i);
}
