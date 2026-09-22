/**
 * Every sentence the ENGINE writes for the owner: record summaries, why a candidate exists, why a rule blocked it, why
 * a remembered decision ended, why the limits check said no. One place, so the wording can be reviewed and the
 * banned-word rule applied to all of it (`copy.test.ts`). Many of these sentences end up inside a hashed record, so a
 * change here only ever affects records made afterwards.
 *
 * Rules (plan §5.1): short plain sentences, first person for what the desk did; "mark" and "above its mark" for the
 * premium; company names the owner knows, never tickers or mints; "PreStocks token", never a share; no promises.
 */
import { pct } from "./units";

export type DeskStateName = "active" | "paused_by_owner" | "stopped_by_loss_limit" | "needs_attention" | "practice";

export const deskCopy = {
  deskState: {
    active: "active",
    paused_by_owner: "paused by you",
    stopped_by_loss_limit: "stopped by your loss limit",
    needs_attention: "waiting for attention",
    practice: "in practice",
  } satisfies Record<DeskStateName, string>,

  nothingToDo: "Nothing to do. Every holding is within its allowed range.",
  notFunded: "Nothing to do: you have not funded the desk yet.",
  priceUnreadable: (name: string, why: string) => `The price of ${name} could not be read: ${why}`,
  notLooking: (state: string) => `The desk is ${state}, so it did not look for anything to do.`,
  pausedMeanwhile: (state: string) => `The desk was ${state} while this was being decided, so nothing was done.`,
  blockedByLimit: (reasons: string[]) => `Blocked: ${reasons.join("; ")}.`,
  noUsableDecision: (why: string) => `No usable decision: ${why}`,
  lossLimitReached: (worth: string, lossBps: number, baseline: string, limitBps: number) =>
    `The desk is worth ${worth}, which is ${pct(lossBps)} below its baseline of ${baseline}. Your loss limit is ${pct(limitBps)}.`,
  approvalExpired: "Your approval request expired. Nothing was done.",

  need: {
    drifted: (name: string, weightBps: number, targetBps: number, thresholdBps: number) =>
      `${name} is ${pct(weightBps)} of the desk against a target of ${pct(targetBps)}. That is further than the ${pct(thresholdBps)} it may wander.`,
    dropped: (name: string) => `${name} is no longer in the mandate, so the desk would sell it.`,
  },

  remembered: {
    stillWaiting: (at: string) => `Still waiting (decided ${at} UTC).`,
    stillWaitingForAnswer: (at: string) => `Still waiting for your answer (asked ${at} UTC).`,
    wouldAlreadyHave: (verb: "bought" | "sold", name: string, at: string) =>
      `Nothing new. The desk would already have ${verb} ${name} at ${at} UTC, and nothing measurable has changed since.`,
    dayPassed: "A day has passed since the desk decided to wait, so it looks again.",
    cashArrived: "New cash arrived in the desk.",
    premiumMoved: (bps: number) => `The premium moved by ${bps} bps since the desk decided to wait.`,
    spotMoved: (bps: number) => `The price moved ${bps} bps since the desk decided to wait.`,
    driftGrew: (bps: number) => `The holding drifted a further ${bps} bps from its target.`,
  },

  blocker: {
    deskNotActive: (state: string) => `The desk is ${state}.`,
    tokenNotAllowed: (name: string) => `You have not allowed the desk to buy ${name}.`,
    referenceUnavailable: (name: string) => `The venue's price for ${name} is missing or too old to act on.`,
    premiumTooHigh: (name: string, premiumBps: number, ceilingBps: number) =>
      `${name} is ${pct(premiumBps)} above its mark. Your ceiling is ${pct(ceilingBps)}.`,
    quoteUnavailable: (name: string) => `No quote for ${name} at this size right now.`,
    beyondPriceBand: (name: string) => `The quote for ${name} is more than 8% from the venue's price. Only you can trade it right now.`,
    movingFast: (name: string, bps: number) =>
      `The price of ${name} is ${pct(bps)} away from its own average of the last half hour. The desk waits for it to settle.`,
    mintPaused: (name: string) => `PreStocks has paused transfers of ${name}.`,
    mintPauseUnknown: (name: string) => `Could not confirm whether transfers of ${name} are paused.`,
    accountFrozen: (name: string) => `The desk's ${name} account is frozen by the issuer. Nobody can move it until it is thawed.`,
    routeTooLarge: (name: string, accounts: number, max: number) =>
      `The swap route for ${name} needs ${accounts} accounts; the desk can carry ${max}.`,
    didThisMinutesAgo: (name: string) => `The desk did the same thing with ${name} a few minutes ago.`,
    lossLimit: (why: string) => `Stopped by your loss limit. ${why}`,
  },

  /** Reasons from the limits check. Lower case, because they are joined into one sentence. */
  gate: {
    nothingToTrade: "nothing to trade, or no price",
    paused: "desk is paused",
    practice: "desk is in practice, so nothing is sent",
    tokenNotAllowed: "you have not allowed this name",
    referenceStale: "the venue's price is missing or older than 15 minutes",
    premiumTooHigh: "the name is further above its mark than your ceiling",
    beyondBand: "the quote is more than 8% from the venue's price",
    farFromReference: "the price is more than 3% from its own half-hour average",
    tooCostly: "this trade would cost more than 2.5% against the price, the 1% PreStocks fee included",
    overPerAction: "over the per-action limit",
    overDaily: "over what is left of the daily limit",
    holdingTooLarge: "it would make this holding larger than you allow",
    notEnoughCash: "not enough cash in the desk",
    notEnoughTokens: "the desk does not hold that much",
  },

  /** The first-person record lines (plan §5.8), for `desk_records.summary`, the feed and notifications. */
  line: {
    checkedNothing: "I checked. Nothing to do: every holding is within its range.",
    waited: (name: string, why: string) => `I waited. ${why} I will look again when that changes, or at the next check.`,
    declined: (name: string, why: string) => `I decided not to act on ${name}. ${why}`,
    bought: (usdc: string, name: string, why: string, fees: string) => `I bought ${usdc} of ${name}. ${why} It cost ${fees} in fees: PreStocks' 1% and the route's.`,
    sold: (tokens: string, name: string, usdc: string, why: string) => `I sold ${tokens} ${name} for ${usdc}. ${why}`,
    wouldHaveBought: (usdc: string, name: string, why: string) => `I would have bought ${usdc} of ${name}. ${why}`,
    wouldHaveSold: (tokens: string, name: string, why: string) => `I would have sold ${tokens} ${name}. ${why}`,
    asked: (what: string, expiresAt: string) => `I asked you: ${what}. Expires ${expiresAt}.`,
    blocked: (reasons: string[]) => `I wanted to act, and a limit stopped me: ${reasons.join("; ")}.`,
    failed: (why: string) => `I could not act: ${why}`,
    noDecision: (why: string) => `I could not decide: ${why}`,
    notExecuted: (why: string) => `You approved it, but I did not act: ${why}`,
    checkpoint: "I sealed the day's record on chain. Nothing was traded.",
    checkedUnpriced: (names: string) => `I checked. I could not price ${names}, so I did nothing.`,
    stoppedByLoss: (why: string) => `I stopped. ${why} Only you can start me again.`,
  },
} as const;
