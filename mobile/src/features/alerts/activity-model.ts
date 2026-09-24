import { estPayoutBase } from "@agari/core/claims";
import type { OpenPosition, Verdict } from "@agari/core/types";
import { assetSpotLine } from "@/features/markets/hero/units";
import { money } from "~/features/portfolio/format";
import { DARK, LIGHT, type Palette } from "~/theme/palette";
import type { ActivityInk, WindowActivityProps } from "./WindowActivity";

/**
 * What the Lock Screen shows, decided purely (S26.4): which open bet (the soonest to close, one at a time), its
 * standing against the opening print, and the finished strings the widget runtime cannot build for itself.
 */

const ink = (p: Palette): ActivityInk => ({ ground: p.ground, ink: p.ink, muted: p.inkSecondary, profit: p.profit, loss: p.loss, accent: p.accent });
export const ACTIVITY_INK = { dark: ink(DARK), light: ink(LIGHT) } as const;

/** How long after its bell a bet is still followed, waiting for its verdict (the activity then ends plainly). */
export const VERDICT_WAIT_MS = 20 * 60_000;

/**
 * The bet the Live Activity follows: one-sided (a hedged seat has no single side), soonest to close while trading;
 * with none trading, the one that closed last and is still waiting for its verdict — so a relaunch after the bell
 * still ends the activity with the result rather than quietly.
 */
export function pickFollowed(positions: readonly OpenPosition[], nowMs: number): OpenPosition | null {
  const oneSided = positions.filter((p) => (p.balanceUpRaw > 0n) !== (p.balanceDownRaw > 0n));
  const live = oneSided.filter((p) => p.expirySec * 1000 > nowMs).sort((a, b) => a.expirySec - b.expirySec);
  if (live[0]) return live[0];
  const waiting = oneSided.filter((p) => nowMs - p.expirySec * 1000 <= VERDICT_WAIT_MS).sort((a, b) => b.expirySec - a.expirySec);
  return waiting[0] ?? null;
}

export type Standing = "ahead" | "behind" | "level" | "";

export function standingOf(up: boolean, openingRaw: bigint | null, spotRaw: bigint | null): Standing {
  if (openingRaw === null || spotRaw === null) return "";
  if (spotRaw === openingRaw) return "level";
  return spotRaw > openingRaw === up ? "ahead" : "behind";
}

export interface ActivityInput {
  position: OpenPosition;
  openingRaw: bigint | null;
  spotRaw: bigint | null;
  symbol: string | undefined;
  verdict: Verdict | null;
  /** The stock's mark URL in the app group, or "". */
  mark: string;
}

export function activityProps({ position, openingRaw, spotRaw, symbol, verdict, mark }: ActivityInput): WindowActivityProps {
  const up = position.balanceUpRaw > 0n;
  const held = up ? position.balanceUpRaw : position.balanceDownRaw;
  const d = position.decimals;
  const result =
    verdict === null
      ? ""
      : verdict.outcome === "win"
        ? `Won ${money(verdict.payoutBase, d, symbol)}`
        : verdict.outcome === "void"
          ? "Void · stake back"
          : "Lost";
  return {
    asset: position.asset,
    mark,
    side: up ? "Up" : "Down",
    up,
    payout: money(estPayoutBase(held, "win"), d, symbol),
    strike: openingRaw !== null ? `Line ${assetSpotLine(position.asset, openingRaw)}` : "Opening print pending",
    // Once decided, the chain's closing print is the answer: the app's live price beside it would only contradict it.
    price: verdict === null && spotRaw !== null ? assetSpotLine(position.asset, spotRaw) : "",
    standing: verdict === null ? standingOf(up, openingRaw, spotRaw) : "",
    closesAtMs: position.expirySec * 1000,
    result,
    resultTone: verdict?.outcome ?? "",
    ...ACTIVITY_INK,
  };
}

/** Android's ongoing notification: the same facts in a title and a body (no native timer there). */
export function ongoingText(props: WindowActivityProps, nowMs: number): { title: string; body: string } {
  const left = Math.max(0, Math.ceil((props.closesAtMs - nowMs) / 1000));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const title = props.result !== "" ? `${props.asset} ${props.side} · ${props.result}` : `${props.asset} ${props.side} · ${left > 0 ? `${clock} left` : "settling"}`;
  const standing = props.standing === "ahead" ? "Winning now" : props.standing === "behind" ? "Losing now" : props.standing === "level" ? "Level" : "";
  const body = [props.strike, props.price ? `Now ${props.price}` : "", standing, props.result === "" ? `Pays ${props.payout} if right` : ""].filter(Boolean).join(" · ");
  return { title, body };
}

/** Two props that would draw the same thing (the timer runs itself; only facts matter). */
export const sameFacts = (a: WindowActivityProps, b: WindowActivityProps) =>
  a.asset === b.asset && a.mark === b.mark && a.side === b.side && a.payout === b.payout && a.strike === b.strike && a.price === b.price && a.standing === b.standing && a.result === b.result && a.closesAtMs === b.closesAtMs;
