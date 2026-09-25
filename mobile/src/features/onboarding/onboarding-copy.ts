/**
 * The app's first run (S26, the owner's call 09-25: "every mobile app has an onboarding flow"). Four screens before
 * the app, each one true of the product today: a Window is a live question on a real stock, a signed oracle price
 * settles it on Solana, the games play the same Windows, and devnet test funds are free. Web's in-page Tutorial card
 * says the same things over /markets; the app shows this instead, once per install.
 */

export interface OnboardingPage {
  readonly key: "call" | "settle" | "play" | "start";
  readonly eyebrow: string;
  readonly title: string;
  /** The title's last words, set in the accent as web's display heads do. */
  readonly accent: string;
  readonly body: string;
}

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    key: "call",
    eyebrow: "Stock prices · Solana",
    title: "Call where a stock",
    accent: "closes.",
    body: "Every Window asks one question about a real stock — above or below a line when the clock runs out. Tap Up or Down; the ticket shows the exact cost before you sign.",
  },
  {
    key: "settle",
    eyebrow: "No one decides but the price",
    title: "Settled by the",
    accent: "price.",
    body: "At the close a signed oracle price settles the Window on-chain, and a winning call pays out. Nobody picks the result.",
  },
  {
    key: "play",
    eyebrow: "Same markets, more ways in",
    title: "Play the same",
    accent: "Windows.",
    body: "Lucky draws a call for you, Duel puts you head to head, Range and Moonshot price a band or a reach, and two arcade runs need no stake at all.",
  },
  {
    key: "start",
    eyebrow: "Solana devnet · test funds only",
    title: "Start with test",
    accent: "money.",
    body: "Agari runs on devnet: connect any Solana wallet and get test tUSDC in one signature. No real money moves, and every order is one you approve.",
  },
];

export const ONBOARDING_UI = {
  skip: "Skip",
  next: "Next",
  connect: "Connect a wallet",
  browse: "Look around first",
  progress: (step: number, total: number) => `${step} of ${total}`,
  example: "Live now",
  settle: {
    opening: "opening print",
    closing: "closing print",
    verdict: "UP wins",
    sources: "+ RedStone · Switchboard",
  },
  games: [
    { name: "Lucky", line: "A call drawn for you" },
    { name: "Duel", line: "Head to head" },
    { name: "Range", line: "Inside the band" },
    { name: "Moonshot", line: "A priced reach" },
    { name: "Line Rider", line: "Arcade · no stake" },
    { name: "Candle Hop", line: "Arcade · no stake" },
  ],
  funds: { label: "Test funds", amount: "Free", note: "tUSDC on Solana devnet · one signature" },
} as const;
