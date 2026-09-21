"use client";

import { MIRROR_WITHIN_MAX_SEC, MIRROR_WITHIN_MIN_SEC } from "@agari/core/strategies";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import type { StudioDraft } from "./studio-draft";

const WITHIN_CHOICES = [60, 120, 300, 900] as const;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** A-3b: the two things a copy-a-trader strategy needs — whose calls, and how fresh one has to be. */
export function StudioMirrorFields({ form, setForm }: { form: StudioDraft; setForm: (update: (f: StudioDraft) => StudioDraft) => void }) {
  const words = STRATEGIES.studio.mirror;
  const trader = form.trader.trim();
  const bad = trader.length > 0 && !BASE58.test(trader);
  return (
    <div className="space-y-6">
      <div>
        <label className="desk-field-label block" htmlFor="mirror-trader">
          {words.traderLabel}
          <input
            id="mirror-trader"
            value={form.trader}
            spellCheck={false}
            onChange={(e) => setForm((f) => ({ ...f, trader: e.target.value.trim() }))}
            placeholder={words.traderPlaceholder}
            className="strat-input mt-2 text-ink"
          />
        </label>
        <p className={bad ? "agent-builder-error mt-2" : "strat-choice-body mt-2"}>{bad ? words.traderInvalid : words.traderHelp}</p>
        {!bad && <p className="strat-choice-body mt-2">{words.traderScope}</p>}
      </div>
      <div>
        <div className="desk-field-label">{words.withinLabel}</div>
        <div className="flex flex-wrap gap-2">
          {WITHIN_CHOICES.filter((sec) => sec >= MIRROR_WITHIN_MIN_SEC && sec <= MIRROR_WITHIN_MAX_SEC).map((sec) => (
            <button
              key={sec}
              type="button"
              aria-pressed={form.mirrorWithinSec === sec}
              onClick={() => setForm((f) => ({ ...f, mirrorWithinSec: sec }))}
              className={cn("strat-chip", form.mirrorWithinSec === sec && "strat-chip--on")}
            >
              {sec < 60 ? `${sec}s` : `${sec / 60}m`}
            </button>
          ))}
        </div>
        <p className="strat-choice-body mt-2">{words.withinHelp}</p>
      </div>
      <p className="strat-choice-body">{words.caveat}</p>
    </div>
  );
}
