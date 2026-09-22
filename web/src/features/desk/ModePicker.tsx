"use client";

import { DESK } from "./copy";

export type LiveMode = "ask_first" | "on_its_own";

/** The two live modes as a radio pair (plan §5.7 item 3); practice is never picked here, it is where every desk starts. */
export function ModePicker({ value, onChange, label }: { value: LiveMode; onChange: (mode: LiveMode) => void; label: string }) {
  return (
    <div className="dk-field">
      <span>{label}</span>
      <div className="dk-choices" role="radiogroup" aria-label={label}>
        {(["ask_first", "on_its_own"] as const).map((mode) => (
          <button key={mode} type="button" role="radio" aria-checked={value === mode} className="dk-choice" onClick={() => onChange(mode)}>
            <span className="dk-choice-title">{DESK.modes[mode]}</span>
            <span className="dk-choice-body">{DESK.modeNote[mode]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
