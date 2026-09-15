/**
 * The link-preview canvas (L-23, Y-14). Satori reads no stylesheet and no CSS variables, so Masayume's dark tokens
 * (`styles/yosuku/part-01.css`) are restated here as rgb strings, one per token the images use. Previews always render
 * the dark ground: a link card has no theme toggle.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const OG = {
  /** `--bg` */
  ground: "rgb(5, 5, 5)",
  /** `--white` */
  ink: "rgb(255, 255, 255)",
  /** `--gray-400` */
  soft: "rgb(163, 163, 163)",
  /** `--gray-500` */
  dim: "rgb(115, 115, 115)",
  /** `--gray-800` */
  hairline: "rgb(38, 38, 38)",
  /** `.crop` corner marks (part-04). */
  crop: "rgba(255, 255, 255, 0.18)",
  /** `.mark-ring` (icons.css): Apple's near-black disc on the dark ground. */
  ring: "rgba(255, 255, 255, 0.22)",
  /** `--vermilion` */
  vermilion: "rgb(224, 77, 38)",
  /** `--color-profit` (dark) */
  up: "rgb(52, 211, 153)",
  /** `--color-loss` (dark) */
  down: "rgb(251, 113, 133)",
} as const;

/** The canvas inset every image shares. */
export const OG_PAD = 72;
