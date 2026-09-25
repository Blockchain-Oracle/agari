import { SESSION as WEB_SESSION } from "@/features/session/copy";

/**
 * web's session copy (features/session/copy.ts) with the phone's own nouns: web's key lives in "this browser", the
 * app's in the Keychain / Keystore on this phone (D-128). Everything else is web's words, unchanged.
 */
export const SESSION = {
  ...WEB_SESSION,
  chip: {
    ...WEB_SESSION.chip,
    titleNeedsKey: "A session grant is live but this phone holds no key for it. Open to revoke or re-key.",
  },
  sheet: {
    ...WEB_SESSION.sheet,
    intro: "Deposit into your Trading Balance and hand a key kept on this phone the right to tap inside these caps. The key can never withdraw; only your wallet can.",
    armedBody: "Taps on this phone sign from the session key inside your caps.",
  },
  manager: {
    ...WEB_SESSION.manager,
    needsKeyBody: "The vault holds a live session grant for a key this phone does not have — the app was reinstalled, or the key is on another device. Revoke it, or re-key: a new grant to a fresh key with the same caps and budget.",
    forgetNote: "Deletes the key from this phone. Do it after revoking — a live grant with no key just sits there.",
  },
} as const;
