import type { ThemeName } from "../../index";

/** Titanium frame of web's PhoneShot (part-18.css `.dl-phone*`): literal in both themes, as web ships it. */
const FRAME = {
  rim: ["#6E6E73", "#2A2A2E", "#141416", "#37373B", "#0C0C0E"] as const,
  rimShadow: "0px 30px 70px -20px rgba(0, 0, 0, 0.8), inset 0px 0px 0px 1px rgba(255, 255, 255, 0.1), inset 0px 1px 2px 0px rgba(255, 255, 255, 0.22)",
  screen: "#050505",
  screenShadow: "0px 0px 0px 1px #000000, 0px 0px 0px 2px rgba(0, 0, 0, 0.9)",
  island: "#000000",
  button: ["#4A4A4F", "#232326", "#17171A"] as const,
  buttonShadow: "0px 0px 0px 0.5px rgba(0, 0, 0, 0.55)",
};

/** web's `/download` as computed on useagari.xyz at 402 px, per theme. */
const DARK = { ...FRAME, pointsRule: "rgba(255, 255, 255, 0.08)" };
const LIGHT: typeof DARK = { ...FRAME, pointsRule: "rgba(20, 18, 16, 0.11)" };

export type DownloadTokens = typeof DARK;
export const downloadTokens = (name: ThemeName): DownloadTokens => (name === "dark" ? DARK : LIGHT);
