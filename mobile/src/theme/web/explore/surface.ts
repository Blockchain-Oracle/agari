import type { ThemeName } from "../../index";

/**
 * web's surface-page.css and the reference SectionHead (yosuku part-05/06/15) as computed on useagari.xyz/surface at
 * 402 px, per theme. The section rule stays white-on-light there (part-05 has no light override), so it does here.
 */
const DARK = {
  sectionRule: "rgba(255, 255, 255, 0.08)",
  livePillBorder: "rgba(224, 77, 38, 0.5)",
  livePillFill: "rgba(224, 77, 38, 0.08)",
  gray700: "#404040",
  chipBorder: "rgba(255, 255, 255, 0.1)",
  chipOnBorder: "rgba(255, 255, 255, 0.25)",
  chipOnFill: "rgba(255, 255, 255, 0.1)",
  windowOnBorder: "rgba(224, 77, 38, 0.4)",
  boxFill: "#050505",
  boxBorder: "rgba(255, 255, 255, 0.08)",
  headRule: "rgba(255, 255, 255, 0.06)",
  grid: "rgba(255, 255, 255, 0.06)",
  bidFill: "rgba(255, 255, 255, 0.14)",
  bidStroke: "rgba(255, 255, 255, 0.55)",
  askFill: "rgba(224, 77, 38, 0.18)",
  midDash: "rgba(224, 77, 38, 0.5)",
  pays: "rgba(52, 211, 153, 0.9)",
  focalWash: "rgba(224, 77, 38, 0.06)",
  dotRing: "rgba(224, 77, 38, 0.3)",
};

const LIGHT: typeof DARK = {
  sectionRule: "rgba(255, 255, 255, 0.08)",
  livePillBorder: "rgba(224, 77, 38, 0.5)",
  livePillFill: "rgba(224, 77, 38, 0.08)",
  gray700: "#C4BAA6",
  chipBorder: "rgba(20, 18, 16, 0.11)",
  chipOnBorder: "rgba(20, 18, 16, 0.22)",
  chipOnFill: "rgba(20, 18, 16, 0.08)",
  windowOnBorder: "rgba(217, 62, 31, 0.4)",
  boxFill: "#FBF7EE",
  boxBorder: "rgba(20, 18, 16, 0.11)",
  headRule: "rgba(20, 18, 16, 0.07)",
  grid: "rgba(20, 18, 16, 0.08)",
  bidFill: "rgba(20, 18, 16, 0.14)",
  bidStroke: "rgba(20, 18, 16, 0.55)",
  askFill: "rgba(217, 62, 31, 0.18)",
  midDash: "rgba(217, 62, 31, 0.5)",
  pays: "rgba(46, 107, 79, 0.9)",
  focalWash: "rgba(217, 62, 31, 0.06)",
  dotRing: "rgba(217, 62, 31, 0.3)",
};

export type SurfaceTokens = typeof DARK;
export const surfaceTokens = (name: ThemeName): SurfaceTokens => (name === "dark" ? DARK : LIGHT);
