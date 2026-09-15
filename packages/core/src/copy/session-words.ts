import { ET_WEEKDAY_SHORT, etDateOf, formatEtClock, weekdayOfDate } from "../market/et-time";
import type { SessionStatus } from "../market/session";
import { formatDuration } from "./between-rounds";

/**
 * The session as a word and a phrase (D-087): every always-on surface says the same thing about the hour. Pure over
 * `SessionStatus`, so the chip, the marquee, the hero foot and the cards can never disagree; the enum is unchanged.
 */
export type SessionWord = "Pre-market" | "Open" | "Early close" | "Halted" | "After hours" | "Closed" | "Weekend" | "Holiday";

/** "Pre-market", "Open", "After hours", "Weekend" (a closed Saturday or Sunday), "Holiday", or "Closed" (a weekday overnight). */
export function sessionStateWord(status: Pick<SessionStatus, "state" | "date">): SessionWord {
  switch (status.state) {
    case "pre":
      return "Pre-market";
    case "regular":
      return "Open";
    case "early-close":
      return "Early close";
    case "halted":
      return "Halted";
    case "post":
      return "After hours";
    case "holiday":
      return "Holiday";
    case "closed":
      return weekdayOfDate(status.date) >= 5 ? "Weekend" : "Closed";
  }
}

export interface SessionCountdown {
  /** What the clock runs to: the close while the market is open, else the next open. */
  kind: "opens" | "closes";
  atSec: number;
  remainingSec: number;
}

/** The boundary the surface counts down to, or null when the calendar doesn't know the next open. */
export function sessionCountdown(status: Pick<SessionStatus, "state" | "closesAtSec" | "nextOpenSec">, nowSec: number): SessionCountdown | null {
  const open = status.state === "regular" || status.state === "early-close" || status.state === "halted";
  if (open && status.closesAtSec !== null) return { kind: "closes", atSec: status.closesAtSec, remainingSec: Math.max(0, status.closesAtSec - nowSec) };
  if (status.nextOpenSec === null) return null;
  return { kind: "opens", atSec: status.nextOpenSec, remainingSec: Math.max(0, status.nextOpenSec - nowSec) };
}

/** "Opens in 16h 12m" / "Closes in 2h 05m" — the hero foot's line. */
export function sessionCountdownLine(countdown: SessionCountdown): string {
  return `${countdown.kind === "opens" ? "Opens" : "Closes"} in ${formatDuration(countdown.remainingSec * 1000)}`;
}

/** "Tue 09:30 ET", or "Tue 12-01 09:30 ET" a week or more away — the same rule as core `sessionLabel`. */
function reopensAt(status: Pick<SessionStatus, "date">, openSec: number): string {
  const openDate = etDateOf(openSec);
  const weekday = ET_WEEKDAY_SHORT[weekdayOfDate(openDate)];
  const days = Math.round((Date.parse(openDate) - Date.parse(status.date)) / 86_400_000);
  return `${weekday}${days >= 7 ? ` ${openDate.slice(5)}` : ""} ${formatEtClock(openSec)} ET`;
}

/**
 * "Pre-market · opens in 1h 12m", "Open · closes in 2h 05m", "After hours · reopens Tue 09:30 ET",
 * "Weekend · reopens Mon 09:30 ET", "Holiday · reopens Fri 09:30 ET". A countdown only while the open is today;
 * a halt says its word alone (the halt reason is the chip's, Q-S6-9); an unknown next open says "Closed".
 */
export function sessionPhrase(status: Pick<SessionStatus, "state" | "date" | "closesAtSec" | "nextOpenSec">, nowSec: number): string {
  const word = sessionStateWord(status);
  if (status.state === "halted") return word;
  const countdown = sessionCountdown(status, nowSec);
  if (!countdown) return word;
  if (countdown.kind === "closes") return `${word} · closes in ${formatDuration(countdown.remainingSec * 1000)}`;
  if (etDateOf(countdown.atSec) === status.date) return `${word} · opens in ${formatDuration(countdown.remainingSec * 1000)}`;
  return `${word} · reopens ${reopensAt(status, countdown.atSec)}`;
}
