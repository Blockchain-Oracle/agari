/**
 * Yosuku's palette as web ships it (web/src/styles/yosuku/part-01.css dark, part-13.css light). The light ramp is
 * inverted there (50 = darkest ink), so every role below resolves per theme exactly as web/src/styles/bridge.css does.
 * React Native has no color-mix(): the washes are the same mixes, precomputed.
 */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const DARK_RAMP = {
  bg: "#050505", ink: "#FFFFFF",
  g400: "#A3A3A3", g500: "#737373", g600: "#525252", g700: "#404040", g800: "#262626", g900: "#171717",
  vermilion: "#E04D26", vermilionD: "#B83A1B", profit: "#34D399", loss: "#FB7185",
};

const LIGHT_RAMP = {
  bg: "#F4EEE3", ink: "#141210",
  g400: "#5E574B", g500: "#7C7466", g600: "#9A9080", g700: "#C4BAA6", g800: "#ECE3D2", g900: "#F6F0E4",
  vermilion: "#D93E1F", vermilionD: "#B83214", profit: "#2E6B4F", loss: "#C2381F",
};

function roles(ramp: typeof DARK_RAMP, dark: boolean) {
  return {
    ground: ramp.bg,
    surface1: ramp.g900,
    surface2: dark ? ramp.g800 : "#ECE3D2",
    surface3: dark ? ramp.g700 : "#FBF7EE",
    hairline: dark ? "rgba(255, 255, 255, 0.1)" : "rgba(20, 18, 16, 0.12)",
    borderStrong: dark ? "rgba(255, 255, 255, 0.22)" : "rgba(20, 18, 16, 0.22)",
    ink: ramp.ink,
    inkSecondary: ramp.g400,
    inkMuted: ramp.g500,
    inkDisabled: ramp.g600,
    accent: ramp.vermilion,
    accentPressed: ramp.vermilionD,
    accentDim: rgba(ramp.vermilion, 0.45),
    accentWash: rgba(ramp.vermilion, 0.12),
    onAccent: "#FFFFFF",
    profit: ramp.profit,
    loss: ramp.loss,
    profitWash: rgba(ramp.profit, 0.14),
    lossWash: rgba(ramp.loss, 0.14),
    // The receipt is a paper island in both themes (bridge.css --color-cream*).
    cream: "#F4EEE3",
    creamInk: "#141210",
    creamHairline: "#D9CBB0",
    scrim: "rgba(4, 3, 2, 0.72)",
    // web's styles/icons.css: the white glyph on a brand disc, and the hairline ring on a near-black disc.
    markGlyph: "#FFFFFF",
    markRing: "rgba(255, 255, 255, 0.22)",
    warning: "#F2994A",
    info: "#60A5FA",
  };
}

export type Palette = ReturnType<typeof roles>;
export const DARK: Palette = roles(DARK_RAMP, true);
export const LIGHT: Palette = roles(LIGHT_RAMP, false);
