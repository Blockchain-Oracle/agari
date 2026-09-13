/**
 * `/download` — the reference's `app/download/page.tsx`, its words truth-corrected: Masayume has
 * no native build, no Google sign-in and no gas sponsor, so every sentence here is about the
 * installable web app on Somnia testnet as it exists.
 */
export const INSTALL = {
  title: "Get Masayume",
  eyebrow: "Masayume on your phone",
  titleLead: "Call it in ",
  titleEm: "ten seconds.",
  line: "Will Bitcoin be higher or lower when the Window closes? Pick a side, pick a stake, and the payout lands in your wallet the moment it settles. Test funds on Somnia testnet, real settlement, and only you can cash out.",
  cta: {
    prompt: "Install Masayume",
    installing: "Opening the install sheet…",
    installed: "Installed · open it from your home screen",
    ios: "Add to Home Screen",
    manual: "Install from your browser menu",
  },
  iosSteps: ["Open this page in Safari", "Tap Share — the square with the arrow", "Tap Add to Home Screen, then Add"],
  manualHint: "Chrome and Edge show an install icon at the right end of the address bar. Other browsers keep “Install” or “Add to Home Screen” under their menu.",
  meta: [
    { label: "Web app", note: "installs from the browser, no store" },
    { label: "Somnia testnet", note: "practice money, real mechanics" },
    { label: "Native", note: "not built — the web app is the product" },
  ],
  points: [
    { title: "Connect and go", body: "Any EVM wallet, through RainbowKit. The faucet hands you test collateral, and there is nothing else to install." },
    { title: "Windows all day", body: "New BTC and ETH Windows open every few minutes. Take one on the walk to work, or sit one out." },
    { title: "Paid on the close", body: "Settlement reads the same oracle print you watched. Win and it is yours to claim — nobody else can." },
  ],
  foot: "Masayume runs on Somnia testnet while it is in beta, so you are playing with practice funds. Everything else is real: real markets, real settlement, real code.",
  shotAlt: "Masayume on a phone: a Bitcoin Window with the live price, the time left, the Up and Down calls, and the stake.",
} as const;
