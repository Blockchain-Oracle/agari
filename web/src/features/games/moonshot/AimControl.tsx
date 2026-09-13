"use client";

import { MOONSHOT_AIM_LADDER, aimToCall, callToAim, type MoonshotAim, type MoonshotCall } from "@masayume/core/range";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, type KeyboardEvent } from "react";
import { usePersistedState } from "@/lib/persisted";
import { cn } from "@/lib/utils";
import { useGames } from "../GamesProvider";
import { MOONSHOT } from "./copy";

/** Pips remembers the aim (`pips_moonshot_aim`); the default is its `DEFAULT_AIM_IDX`, LONG ×5. */
const AIM_KEY = "masayume.games.moonshot.aim";
const DEFAULT_AIM: MoonshotAim = 5;
const LAST = MOONSHOT_AIM_LADDER.length - 1;
/** Deepest LONG at the ceiling, deepest SHORT at the floor — the knob's own order, read top down. */
const LONG_RUNGS = [...MOONSHOT_AIM_LADDER].filter((aim) => aim > 0).reverse();
const SHORT_RUNGS = [...MOONSHOT_AIM_LADDER].filter((aim) => aim < 0).reverse();

const aimCodec = {
  parse: (raw: string): MoonshotAim | null => {
    const n = Number(raw);
    return (MOONSHOT_AIM_LADDER as readonly number[]).includes(n) ? (n as MoonshotAim) : null;
  },
  serialize: (aim: MoonshotAim) => String(aim),
};

/** The call, remembered on this device; the default until storage has been read, so server and client agree. */
export function useRememberedCall(): [MoonshotCall, (call: MoonshotCall) => void] {
  const [aim, setAim] = usePersistedState<MoonshotAim>(AIM_KEY, DEFAULT_AIM, aimCodec);
  const setCall = useCallback((call: MoonshotCall) => setAim(callToAim(call)), [setAim]);
  return [aimToCall(aim), setCall];
}

interface AimControlProps {
  call: MoonshotCall;
  onCall: (call: MoonshotCall) => void;
  disabled?: boolean;
}

/**
 * Pips' AIM knob as a ladder: ten rungs, the sign is the side and the distance the reach. Arrow keys climb
 * and descend it, a tap lands on a rung, and the flip sting fires only when the side crosses the middle —
 * a step within a side is just the control's own click.
 */
export function AimControl({ call, onCall, disabled }: AimControlProps) {
  const { feedback } = useGames();
  const words = MOONSHOT.aim;
  const aim = callToAim(call);
  const index = MOONSHOT_AIM_LADDER.indexOf(aim);

  const set = useCallback(
    (next: number) => {
      const nextAim = MOONSHOT_AIM_LADDER[Math.max(0, Math.min(LAST, next))];
      if (nextAim === undefined || nextAim === aim) return;
      if (nextAim > 0 !== aim > 0) feedback(nextAim > 0 ? "swipe-up" : "swipe-down");
      onCall(aimToCall(nextAim));
    },
    [aim, onCall, feedback],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") set(index + 1);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") set(index - 1);
    else if (e.key === "Home") set(LAST);
    else if (e.key === "End") set(0);
    else return;
    e.preventDefault();
  };

  const rung = (value: MoonshotAim) => {
    const on = value === aim;
    const long = value > 0;
    return (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={words.valueText(long ? "long" : "short", Math.abs(value))}
        tabIndex={on ? 0 : -1}
        disabled={disabled}
        onClick={() => set(MOONSHOT_AIM_LADDER.indexOf(value))}
        className={cn("ms-rung", long ? "ms-rung--long" : "ms-rung--short")}
        data-cursor="hover"
      >
        <span className="ms-rung-side">{long ? "L" : "S"}</span>
        <span className="ms-rung-x">{words.rung(Math.abs(value))}</span>
      </button>
    );
  };

  const long = call.direction === "long";
  return (
    <div className="ms-aim">
      <div className="ms-aim-head">
        <span className="ms-aim-label">{words.label}</span>
        <span className="ms-aim-must">{words.must}</span>
      </div>
      <div className="ms-aim-body">
        <div className="ms-ladder" role="radiogroup" aria-label={words.ladder} onKeyDown={onKeyDown}>
          {LONG_RUNGS.map(rung)}
          <span className="ms-ladder-mid" aria-hidden />
          {SHORT_RUNGS.map(rung)}
        </div>
        <div className="ms-readout" aria-live="polite">
          <div className={cn("ms-readout-x", long ? "ms-readout-x--long" : "ms-readout-x--short")}>{words.rung(call.multiple)}</div>
          <div className={cn("ms-readout-side", long ? "ms-readout-side--long" : "ms-readout-side--short")}>{long ? words.long : words.short}</div>
          <p className="ms-readout-hint">{words.hint}</p>
          <div className="ms-readout-btns">
            <button type="button" onClick={() => set(index + 1)} disabled={disabled || index === LAST} className="rg-icon-btn" aria-label={words.up} title={words.up}>
              <ChevronUp />
            </button>
            <button type="button" onClick={() => set(index - 1)} disabled={disabled || index === 0} className="rg-icon-btn" aria-label={words.down} title={words.down}>
              <ChevronDown />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
