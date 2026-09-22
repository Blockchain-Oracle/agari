import { ImageResponse } from "next/og";
import { ogFonts } from "@/features/landing/og/fonts";
import { OgFrame } from "@/features/landing/og/OgFrame";
import { OG, OG_SIZE } from "@/features/landing/og/theme";
import { DESK } from "./copy";
import { RECORD } from "./copy-record";
import { ago } from "./format";

export interface DeskOgFacts {
  mode: "practice" | "ask_first" | "on_its_own";
  live: boolean;
  checks: number;
  lastCheckSec: number | null;
  nowSec: number;
}

const HEADLINE = { display: "flex", fontSize: 88, lineHeight: 0.95, letterSpacing: "-0.035em" } as const;

/** A shared desk's link preview (the `features/share` pattern, L-23): its mode, how many checks, its last check. Never a figure. */
export async function deskImage(facts: DeskOgFacts): Promise<ImageResponse> {
  const O = RECORD.og;
  return new ImageResponse(
    <OgFrame eyebrow={O.eyebrow}>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 28 }}>
        <div style={{ ...HEADLINE, color: OG.ink }}>{O.title}</div>
        <div style={{ display: "flex", gap: 24, fontSize: 36, color: OG.vermilion }}>
          <span>{DESK.modes[facts.mode]}</span>
          <span style={{ color: OG.dim }}>·</span>
          <span style={{ color: OG.soft }}>{facts.live ? O.live : O.practice}</span>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: OG.soft }}>{O.checks(facts.checks)}</div>
        <div style={{ display: "flex", fontSize: 26, color: OG.dim }}>{facts.lastCheckSec === null ? O.noCheck : O.lastCheck(ago(facts.lastCheckSec, facts.nowSec))}</div>
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
