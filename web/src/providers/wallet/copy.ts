/**
 * The wallet modals' words: RainbowKit 2.2.11's `en_US` strings as Masayume showed them, with "Ethereum" made
 * "Solana" wherever the sentence names the chain. Nothing else is reworded, so the modal reads as it did there.
 */
export const WALLET_MODAL = {
  title: "Connect a Wallet",
  close: "Close",
  back: "Back",
  groups: { installed: "Installed", browser: "Browser" },
  recent: "Recent",
  newTo: "New to Solana wallets?",
  learnMore: "Learn More",
  learnMoreUrl: "https://solana.com/learn/what-is-a-wallet",
  intro: {
    title: "What is a Wallet?",
    description:
      "A wallet is used to send, receive, store, and display digital assets. It's also a new way to log in, without needing to create new accounts and passwords on every website.",
    assetsTitle: "A Home for your Digital Assets",
    assetsBody: "Wallets are used to send, receive, store, and display digital assets like SOL and NFTs.",
    loginTitle: "A New Way to Log In",
    loginBody: "Instead of creating new accounts and passwords on every website, just connect your wallet.",
    get: "Get a Wallet",
  },
  get: {
    title: "Get a Wallet",
    action: "GET",
    lookingTitle: "Not what you're looking for?",
    lookingBody: "Select a wallet on the main screen to get started with a different wallet provider.",
  },
  status: {
    opening: (wallet: string) => `Opening ${wallet}...`,
    notInstalled: (wallet: string) => `${wallet} is not installed`,
    confirm: "Confirm connection in the extension",
    retry: "RETRY",
    install: "INSTALL",
    loading: "Loading",
  },
  profile: { copy: "Copy Address", copied: "Copied!", disconnect: "Disconnect" },
} as const;

export interface KnownWallet {
  /** The Wallet Standard name the wallet registers under, which is how an installed one is recognised. */
  name: string;
  icon: string;
  /** RainbowKit's `get.*.description` for what the download offers. */
  kind: string;
  href: string;
}

/** Offered when not installed, in RainbowKit's "Browser" group and on "Get a Wallet" (D-023's three). */
export const KNOWN_WALLETS: readonly KnownWallet[] = [
  { name: "Phantom", icon: "/wallet/phantom.svg", kind: "Browser Extension", href: "https://phantom.com/download" },
  { name: "Solflare", icon: "/wallet/solflare.svg", kind: "Browser Extension", href: "https://solflare.com/download" },
  { name: "Backpack", icon: "/wallet/backpack.png", kind: "Browser Extension", href: "https://backpack.app/download" },
];
