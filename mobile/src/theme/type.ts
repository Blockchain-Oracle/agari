import type { TextStyle } from "react-native";

/** Loaded font family names (expo-font keys); faces as web's lib/fonts.ts: Sora display, Inter body, JetBrains Mono data, Noto Serif JP stamp. */
export const FONT = {
  headingRegular: "Sora_400Regular",
  headingSemi: "Sora_600SemiBold",
  heading: "Sora_700Bold",
  headingHeavy: "Sora_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodyStrong: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  bodyHeavy: "Inter_800ExtraBold",
  dataRegular: "JetBrainsMono_400Regular",
  data: "JetBrainsMono_500Medium",
  dataStrong: "JetBrainsMono_600SemiBold",
  stamp: "NotoSerifJP_700Bold",
} as const;

/** bridge.css's type scale; letter-spacing em → points at each size. */
export const TYPE = {
  display: { fontFamily: FONT.heading, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  headline: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 30, letterSpacing: -0.52 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19 },
  labelMicro: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 13, letterSpacing: 1.76, textTransform: "uppercase" },
  data: { fontFamily: FONT.data, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  dataLg: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  dataHero: { fontFamily: FONT.dataStrong, fontSize: 40, lineHeight: 42, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  stamp: { fontFamily: FONT.stamp, fontSize: 28, lineHeight: 31 },
  stampHero: { fontFamily: FONT.stamp, fontSize: 64, lineHeight: 64 },
} satisfies Record<string, TextStyle>;

export const RADIUS = { sm: 4, md: 8, lg: 12, xl: 24, full: 9999 } as const;
/** 4-pt grid; gutter 16, touch target 44 (bridge.css --spacing*). */
export const SPACE = { unit: 4, gutter: 16, section: 64, touch: 44 } as const;
