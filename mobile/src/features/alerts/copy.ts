import type { PushKind } from "@/features/push/protocol";

/** The phone's notification settings and the Live Activity / widget words (S26.4). */
export const ALERTS = {
  title: "Notifications",
  intro: "Hear about your calls when Agari is closed: fills, results and money waiting for you.",
  on: "Turn on notifications",
  off: "Turn off notifications",
  switching: "Working…",
  signNote: "Your wallet signs once to prove this phone may hear about it. No transaction, no fee.",
  following: (wallet: string) => `Notifying this phone about ${wallet}`,
  otherWallet: (wallet: string) => `This phone is set up for ${wallet}, not the wallet connected now.`,
  moveHere: "Follow the connected wallet instead",
  connectFirst: "Connect a wallet to turn notifications on.",
  kinds: {
    fills: { label: "Calls filled", hint: "When a call fills, including one that rested at your price." },
    results: { label: "Results", hint: "When a Window you hold settles: won, lost or voided." },
    payouts: { label: "Payouts", hint: "When winnings are waiting to be claimed, or were paid for you." },
  } satisfies Record<PushKind, { label: string; hint: string }>,
  live: {
    title: "Live on the Lock Screen",
    body: "While you hold a call, its countdown and standing sit on the Lock Screen and in the Dynamic Island.",
    android: "While you hold a call, its countdown stays in your notifications until the Window settles.",
  },
  widget: {
    title: "Home Screen widget",
    body: "Add the Agari widget from the Home Screen's edit menu to see the next Windows to close.",
  },
  errors: {
    connect: "Connect a wallet first.",
    denied: "Notifications are off for Agari in Settings. Turn them on there, then try again.",
    token: "This phone could not get a push address",
    failed: "That did not work. Try again.",
  },
} as const;
