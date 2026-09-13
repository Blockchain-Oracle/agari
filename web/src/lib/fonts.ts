import { Inter, JetBrains_Mono, Noto_Serif_JP, Sora } from "next/font/google";

/**
 * Yosuku's four faces, with the same variable names and weights as the reference
 * (reference/yosuku/app/layout.tsx @ 3c56ef5). The ported design system addresses
 * these variables directly, so the names are part of the contract — not a preference.
 */

export const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700"],
});

export const fontVariables = [sora.variable, inter.variable, jetbrainsMono.variable, notoSerifJp.variable].join(" ");
