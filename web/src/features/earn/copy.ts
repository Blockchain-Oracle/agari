import { MAKER_NOT_DEPLOYED } from "@masayume/core/maker";

/**
 * `/earn` — the reference's words (`app/earn/page.tsx`), facts adapted to DreamDEX: the vault is not the
 * venue's counterparty (DreamDEX has none) but Masayume's own maker, resting a bid and an ask on the venue's
 * books; the spread it earns and the inventory it carries are readable per Window.
 */
export const EARN = {
  /** The reference's hero: "Earn the *spread*." */
  title: "Earn the",
  titleAccent: "spread",
  panel: {
    /** The reference: "Closed pool · 4-16" / "Predict PLP" — its own truth correction for a retired pool. Ours is live, or says why not. */
    live: "Live · maker vault",
    paused: "Paused · maker vault",
    noMaker: "No maker key · quotes off",
    brand: "Masayume MM",
    perShare: "/ share",
    sinceLaunch: "Up from 1.0000 at launch",
    belowLaunch: "Below 1.0000 — the vault is carrying a loss",
    vaultValue: "Vault value",
    utilization: "Utilization",
    loading: "loading the vault…",
  },
  sections: {
    supply: { number: "01", title: "Supply the vault", meta: "withdraw what is idle, any time" },
    windows: { number: "02", title: "Where the capital is", meta: "one row per Window the maker is on" },
  },
  paused: {
    title: "New deposits are paused",
    body: "The vault's admin has paused new supply. Anything you already supplied is untouched: settlement, merges and withdrawals keep running, and you can withdraw what is idle any time.",
  },
  supply: {
    amount: "Amount",
    wallet: (balance: string, symbol: string) => `wallet ${balance} ${symbol}`,
    walletPending: "wallet …",
    walletReading: "Still reading your wallet balance — a moment.",
    max: "Max",
    connect: "Connect a wallet to supply.",
    button: (symbol: string) => `Supply ${symbol}`,
    busy: "Supplying…",
    pausedButton: "Paused",
    enterAmount: "Enter an amount",
    noFunds: (symbol: string) => `No ${symbol} in your wallet. Claim some from the faucet first.`,
    done: "Done ✓",
  },
  position: {
    title: "Your position",
    connect: "Connect a wallet to see it.",
    empty: "Nothing here yet.",
    shares: (shares: string, price: string) => `${shares} shares · at ${price} / share`,
    withdrawAll: "Withdraw all",
    withdrawIdle: (amount: string, symbol: string) => `Withdraw ${amount} ${symbol} idle`,
    busy: "Withdrawing…",
    settling: "Settling a closed Window first…",
    deployedNote: (amount: string, symbol: string) => `${amount} ${symbol} of your position is deployed on live Windows. It comes back as they settle; withdraw the rest then.`,
    unsettledNote: "A Window has closed but is not settled yet. Withdrawing settles it first — anyone may.",
  },
  windows: {
    empty: "The maker has no Window open. Quotes go out on the venue's live lanes when the actor runs.",
    window: "Window",
    deployed: "Deployed",
    inventory: "Holding",
    state: "State",
    result: "Result",
    resting: "quotes resting",
    paired: (pairs: string) => `${pairs} sets paired · merge`,
    oneSided: (side: string, qty: string) => `${qty} ${side} unpaired`,
    closed: "closed · settle",
    settled: "settled",
    merge: "Merge",
    settle: "Settle",
    busy: "Sending…",
    history: "Recent Windows",
  },
  notDeployed: {
    eyebrow: "Liquidity",
    title: "Earn",
    body: "Commit capital to market making, then inspect the real inventory, exposure, and exit accounting behind your share — not an advertised yield.",
    why: MAKER_NOT_DEPLOYED,
    dependency: "the MarketMakerVault contract — deploy with contracts/script/DeployMarketMakerVault.s.sol, then pnpm contracts:export",
  },
  devTitle: "Earn",
} as const;
