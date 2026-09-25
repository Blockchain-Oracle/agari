import { INSTALL } from "@/features/install/copy";

/** The native builds' public links, set per release (S26.8); unset until one is published. */
const TESTFLIGHT_URL = process.env.EXPO_PUBLIC_TESTFLIGHT_URL ?? "";
const APK_URL = process.env.EXPO_PUBLIC_APK_URL ?? "";

/**
 * web's `/download` words where they stay true inside the installed app; the CTA and the meta row say where else Agari
 * runs, since this phone already has it.
 */
export const APP_INSTALL = {
  ...INSTALL,
  eyebrow: "Agari on your other devices",
  cta: "Get it on another device",
  /** web's `.dl-steps` under the expanded CTA: the other places Agari installs. */
  steps: (site: string) => [
    `On a computer or another phone, open ${site.replace(/^https?:\/\//, "")}`,
    "Install it from the browser: Chrome and Edge show an install icon in the address bar; in Safari tap Share, then Add to Home Screen",
    "Connect the same wallet there and your calls, record and funds follow you",
  ],
  /** The native builds, listed only once their public links exist. */
  builds: [
    { label: "iPhone · TestFlight", url: TESTFLIGHT_URL },
    { label: "Android · APK", url: APK_URL },
  ].filter((build) => build.url !== ""),
  meta: [
    { label: "This phone", note: "the native app, installed" },
    { label: "Web app", note: "any computer or phone browser, no store" },
    { label: "Solana devnet", note: "practice money, real mechanics" },
  ],
} as const;
