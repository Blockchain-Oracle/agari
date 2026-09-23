import { useTheme } from "~/theme";

export interface PlateInk {
  paper: string;
  raised: string;
  ink: string;
  mute: string;
  line: string;
  figure: string;
  wallet: string;
  account: string;
}

/**
 * web `ledger-plate.css`: the plate owns four tokens — paper, ink, muted ink, line — and follows the theme (the owner's
 * 2026-09-05 ruling): the theme's surface and inks in dark, the reference's light paper in light. Everything on the
 * plate (pool rows, the X card, the Trading Balance panel) reads these, so one card never shows two backgrounds.
 */
export function usePlateInk(): PlateInk {
  const { name, color } = useTheme();
  const dark = name === "dark";
  return {
    paper: dark ? color.surface1 : color.surface3,
    raised: dark ? color.surface2 : color.cream,
    ink: color.ink,
    mute: color.inkSecondary,
    line: color.hairline,
    figure: color.accent,
    wallet: color.accent,
    account: color.accentDim,
  };
}
