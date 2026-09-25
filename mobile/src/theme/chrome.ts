import type { ThemeName } from "./index";

/**
 * web's phone chrome as the browser computes it at 402 px (appstrip, marquee, header, the floating dock and the
 * drawer): yosuku part-02/03/14/15, shell.css, navigation.css and tokens.css --nav-*. Read off useagari.xyz, per theme.
 */
const DARK = {
  stripBg: "#000000", connectInk: "#FFFFFF", logoInk: "#FFFFFF", stripBorder: "rgba(224, 77, 38, 0.3)", stripText: "#A3A3A3", stripGo: "#E04D26", stripX: "#525252",
  marqueeBg: "#000000", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#525252", marqueeValue: "#FFFFFF",
  headerBg: "rgba(5, 5, 5, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(224, 77, 38, 0.55)",
  toggleBorder: "rgba(255, 255, 255, 0.1)", toggleInk: "#A3A3A3",
  pillBorder: "rgba(255, 255, 255, 0.12)", pillInk: "#D4D4D4", pillTotal: "#FFFFFF", pillDim: "rgba(255, 255, 255, 0.55)", pillUnit: "#737373",
  addrDotFrom: "#FFFFFF", addrDotTo: "#D4D4D4",
  menuBorder: "rgba(255, 255, 255, 0.1)", menuBg: "#050505", menuRowLabel: "#737373", menuVal: "#FFFFFF", menuValSoft: "rgba(255, 255, 255, 0.8)", menuLink: "#D4D4D4", menuDanger: "rgba(224, 77, 38, 0.7)", menuPoolsBorder: "rgba(255, 255, 255, 0.06)",
  dockBg: "rgba(12, 12, 12, 0.72)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#737373", dockActiveInk: "#FFFFFF", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(255, 255, 255, 0.1)", navDivider: "rgba(255, 255, 255, 0.08)", navSectionDivider: "rgba(255, 255, 255, 0.07)",
  navItemBorder: "rgba(255, 255, 255, 0.08)", navItemFill: "rgba(255, 255, 255, 0.045)", navIconBorder: "rgba(255, 255, 255, 0.09)", navActiveBorder: "rgba(224, 77, 38, 0.35)",
  navLinkInk: "#D4D4D4",
  toastBg: "rgba(23, 23, 23, 0.9)", toastBorder: "rgba(255, 255, 255, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#FFFFFF", toastMuted: "#A3A3A3", toastIcon: "#737373",
};

const LIGHT: typeof DARK = {
  stripBg: "#F4EEE3", connectInk: "#FBF7EE", logoInk: "#141210", stripBorder: "rgba(224, 77, 38, 0.3)", stripText: "#5E574B", stripGo: "#D93E1F", stripX: "#9A9080",
  marqueeBg: "#F4EEE3", marqueeBorder: "rgba(255, 255, 255, 0.06)", marqueeLabel: "#9A9080", marqueeValue: "#141210",
  headerBg: "rgba(244, 238, 227, 0.96)", headerBorder: "rgba(255, 255, 255, 0.06)", logoJp: "rgba(217, 62, 31, 0.65)",
  toggleBorder: "rgba(20, 18, 16, 0.14)", toggleInk: "#5E574B",
  pillBorder: "rgba(20, 18, 16, 0.14)", pillInk: "rgba(20, 18, 16, 0.75)", pillTotal: "#141210", pillDim: "rgba(20, 18, 16, 0.55)", pillUnit: "#7C7466",
  addrDotFrom: "#141210", addrDotTo: "#453E33",
  menuBorder: "rgba(20, 18, 16, 0.12)", menuBg: "#F4EEE3", menuRowLabel: "#7C7466", menuVal: "#141210", menuValSoft: "rgba(20, 18, 16, 0.8)", menuLink: "#453E33", menuDanger: "rgba(217, 62, 31, 0.7)", menuPoolsBorder: "rgba(20, 18, 16, 0.08)",
  dockBg: "rgba(244, 238, 227, 0.82)", dockBorder: "rgba(255, 255, 255, 0.08)", dockInk: "#7C7466", dockActiveInk: "#141210", dockActiveFill: "rgba(255, 255, 255, 0.08)",
  navOverlay: "rgba(0, 0, 0, 0.72)", navPanelBorder: "rgba(20, 18, 16, 0.12)", navDivider: "rgba(20, 18, 16, 0.09)", navSectionDivider: "rgba(20, 18, 16, 0.09)",
  navItemBorder: "rgba(20, 18, 16, 0.1)", navItemFill: "rgba(20, 18, 16, 0.04)", navIconBorder: "rgba(20, 18, 16, 0.12)", navActiveBorder: "rgba(217, 62, 31, 0.35)",
  navLinkInk: "#453E33",
  toastBg: "rgba(251, 247, 238, 0.9)", toastBorder: "rgba(20, 18, 16, 0.22)", toastWarnBorder: "rgba(242, 153, 74, 0.2)", toastInk: "#141210", toastMuted: "#5E574B", toastIcon: "#7C7466",
};

export type ChromeTokens = typeof DARK;
export const chromeTokens = (name: ThemeName): ChromeTokens => (name === "dark" ? DARK : LIGHT);

/** Heights of the fixed chrome (px = pt): strip 28, marquee 20, header 46 — web's main padding-top 94. */
export const CHROME = { strip: 28, marquee: 20, header: 46, dockClearance: 112 } as const;
