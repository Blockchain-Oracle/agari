import type { ThemeName } from "../index";

/**
 * web's tap-trading dialogs (SessionModal / SessionManager) per theme: the shared centred dialog (modal.css `.modal-*`),
 * the AccountSetup card (`.setup-card`), the disclosures (`.modal-disclosure > summary`) and SessionDetails.module.css.
 * The ink, hairline and surface-2 roles come from the palette, which already equals web's values.
 */
const DARK = {
  scrim: "rgba(0, 0, 0, 0.7)",
  panel: "#0D0D10", panelBorder: "rgba(255, 255, 255, 0.1)", shadow: "#000000",
  close: "#525252", eyebrow: "#737373", desc: "#A3A3A3", dot: "#E04D26",
  setupBg: "rgba(255, 255, 255, 0.03)", setupBorder: "rgba(255, 255, 255, 0.08)", setupText: "#A3A3A3",
  summary: "rgba(255, 255, 255, 0.45)",
};

const LIGHT: typeof DARK = {
  scrim: "rgba(0, 0, 0, 0.7)",
  panel: "#F4EEE3", panelBorder: "rgba(20, 18, 16, 0.12)", shadow: "#000000",
  close: "#9A9080", eyebrow: "#7C7466", desc: "#5E574B", dot: "#D93E1F",
  setupBg: "rgba(20, 18, 16, 0.03)", setupBorder: "rgba(20, 18, 16, 0.08)", setupText: "#5E574B",
  summary: "rgba(20, 18, 16, 0.6)",
};

export type SessionTokens = typeof DARK;
export const sessionTokens = (name: ThemeName): SessionTokens => (name === "dark" ? DARK : LIGHT);
