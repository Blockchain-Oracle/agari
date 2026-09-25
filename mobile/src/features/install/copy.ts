import { INSTALL } from "@/features/install/copy";

/**
 * web's `/download` words where they stay true inside the installed app; the CTA and the meta row say where else Agari
 * runs, since this phone already has it.
 */
export const APP_INSTALL = {
  ...INSTALL,
  eyebrow: "Agari on your other devices",
  cta: "Send yourself the link",
  shareMessage: (url: string) => `Agari — call the close. ${url}`,
  meta: [
    { label: "This phone", note: "the native app, installed" },
    { label: "Web app", note: "any computer or phone browser, no store" },
    { label: "Solana devnet", note: "practice money, real mechanics" },
  ],
} as const;
