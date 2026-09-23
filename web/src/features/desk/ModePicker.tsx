"use client";

import { Hand, Zap } from "lucide-react";
import { RadioCards } from "@/components/ui/desk-kit";
import { DESK } from "./copy";
import "./studio/studio.css";

export type LiveMode = "ask_first" | "on_its_own";

const ICON: Record<LiveMode, React.ReactNode> = { ask_first: <Hand className="size-5" />, on_its_own: <Zap className="size-5" /> };

/** The two live modes as radio cards (plan §5.7 item 3); practice is never picked here, it is where every desk starts. */
export function ModePicker({ value, onChange, label }: { value: LiveMode; onChange: (mode: LiveMode) => void; label: string }) {
  return (
    <div className="st-block">
      <span className="st-label">{label}</span>
      <RadioCards
        value={value}
        onChange={onChange}
        label={label}
        className="st-modes"
        items={(["ask_first", "on_its_own"] as const).map((mode) => ({
          value: mode,
          media: <span className="st-icon-tile" data-level={mode === "ask_first" ? "careful" : "loose"}>{ICON[mode]}</span>,
          title: DESK.modes[mode],
          body: DESK.modeNote[mode],
        }))}
      />
    </div>
  );
}
