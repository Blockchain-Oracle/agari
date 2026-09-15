/**
 * `/download` — the reference's `app/download/page.tsx`, its words truth-corrected: Agari has no native build and
 * no Google sign-in, so every sentence here is about the installable web app on Solana devnet as it exists.
 */
export const INSTALL = {
  title: "Get Agari",
  eyebrow: "Agari on your phone",
  titleLead: "Call it in ",
  titleEm: "ten seconds.",
  line: "Will the stock close this Window higher or lower? Pick a side, pick a stake, and the payout is yours to collect the moment it settles. Test funds on Solana devnet, real settlement, and only you can cash out.",
  cta: {
    prompt: "Install Agari",
    installing: "Opening the install sheet…",
    installed: "Installed · open it from your home screen",
    ios: "Add to Home Screen",
    manual: "Install from your browser menu",
  },
  iosSteps: ["Open this page in Safari", "Tap Share — the square with the arrow", "Tap Add to Home Screen, then Add"],
  manualHint: "Chrome and Edge show an install icon at the right end of the address bar. Other browsers keep “Install” or “Add to Home Screen” under their menu.",
  meta: [
    { label: "Web app", note: "installs from the browser, no store" },
    { label: "Solana devnet", note: "practice money, real mechanics" },
    { label: "Native", note: "not built — the web app is the product" },
  ],
  points: [
    { title: "Connect and go", body: "Any Solana wallet that speaks the Wallet Standard. The faucet hands you test tUSDC, and a little SOL for fees if you are short. There is nothing else to install." },
    { title: "Open after the bell", body: "Stock Windows every few minutes while US markets trade, a weekend Window from Friday's close to Monday's open, and 24/7 Windows on tokenised stock. When the exchange is shut, rest a call at your price for the open." },
    { title: "Paid on the close", body: "Settlement reads the signed price for the closing second, the same feed you watched. Win and it is yours to claim — nobody else can." },
  ],
  foot: "Agari runs on Solana devnet while it is in beta, so you are playing with practice funds. Everything else is real: real order books, real signed prices, real settlement, real code.",
  shotAlt: "Agari on a phone after the close: the stock's last price, the next session on the clock, and a call that can be scheduled for the open.",
} as const;
