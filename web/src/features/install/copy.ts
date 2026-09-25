/**
 * `/download` — the reference's `app/download/page.tsx`, its words truth-corrected. Since 09-25 Agari ships a native
 * Android build (the APK on the GitHub release below) and an iOS build headed for TestFlight; the web app still
 * installs from the browser. Every sentence is about what exists on Solana devnet today.
 */

/** The published Android build: GitHub release `android-v0.1.0`, built by EAS 09-25. */
export const ANDROID_RELEASE = {
  version: "0.1.0",
  url: "https://github.com/Blockchain-Oracle/agari/releases/download/android-v0.1.0/agari-0.1.0.apk",
  page: "https://github.com/Blockchain-Oracle/agari/releases/tag/android-v0.1.0",
  sha256: "96f512678f289a0c0ce201c303d7f663d46e67e9d365654bf4151e4113af6447",
  sizeMb: 170,
  qr: "/download/agari-android-qr.svg",
} as const;
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
    { label: "Android", note: "the APK, signed, from our GitHub release" },
    { label: "iPhone", note: "TestFlight next · the web app installs today" },
    { label: "Solana devnet", note: "practice money, real mechanics" },
  ],
  film: { label: "The launch film", poster: "/media/agari-launch-poster.jpg", src: "/media/agari-launch.mp4" },
  android: {
    eyebrow: "Android",
    title: "Get the APK",
    scan: "Scan with your phone's camera",
    cta: "Download the APK",
    size: (mb: number, v: string) => `Version ${v} · ${mb} MB`,
    steps: ["Download on your Android phone", "Open the file and allow installs from this source when Android asks", "Open Agari and connect a wallet, or practise first"],
    shaLabel: "SHA-256",
    copy: "Copy",
    copied: "Copied",
    verify: "Check it with sha256sum, or shasum -a 256 on a Mac",
    release: "Release notes on GitHub",
  },
  ios: {
    eyebrow: "iPhone",
    title: "TestFlight is next",
    body: "The iOS build is on its way to TestFlight. Until the invite link is here, install the web app: it is the same Agari, from your home screen.",
  },
  points: [
    { title: "Connect and go", body: "Any Solana wallet that speaks the Wallet Standard. The faucet hands you test tUSDC, and a little SOL for fees if you are short. There is nothing else to install." },
    { title: "Open after the bell", body: "Stock Windows every few minutes while US markets trade, a weekend Window from Friday's close to Monday's open, and 24/7 Windows on tokenised stock. When the exchange is shut, rest a call at your price for the open." },
    { title: "Paid on the close", body: "Settlement reads the signed price for the closing second, the same feed you watched. Win and it is yours to claim — nobody else can." },
  ],
  foot: "Agari runs on Solana devnet while it is in beta, so you are playing with practice funds. Everything else is real: real order books, real signed prices, real settlement, real code.",
  shotAlt: "Agari on a phone after the close: the stock's last price, the next session on the clock, and a call that can be scheduled for the open.",
} as const;
