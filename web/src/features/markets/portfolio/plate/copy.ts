/** The plate's words, the reference's own where they are still true (`BalancePlate.tsx`, `PoolRows.tsx`, `useMoney.ts`). */
export const PLATE = {
  eyebrow: "Ready to bet",
  yours: "yours",
  elsewhere: "elsewhere",
  addMoney: "Add money",
  /** "Get test DUSDC" — the collateral is tUSDC here. */
  getTest: "Get test funds",
  inWallet: "In your wallet",
  /** The reference's betting account is the Trading Balance here, and every other surface calls it that. */
  inAccount: "In your Trading Balance",
  open: "open",
  settled: "settled",
  poolsEyebrow: "Elsewhere · not spendable here",
  vaultDisclosure: "Trading Balance · deposit and withdraw",
  pools: {
    x: {
      label: "X replies",
      note: "Your X replies bet from this. Only you can cash it out.",
      manage: "Manage",
      update: "Update X trading",
      updateNote: "Your existing permission needs an update. Open this row to use your funded X balance.",
      mismatch: (wallet: string) => `This X account bets from ${wallet}. Connect that wallet to use this balance.`,
      unlinked: "Link your X account and you can bet by replying to a card.",
    },
    private: {
      label: "Private",
      /** The desk's balance plus the vault's private bucket; the reference summed its tickets and the vault the same way (`portfolio/page.tsx` L195). */
      note: "Private bets spend from this. Only you can withdraw it.",
      manage: "Manage",
    },
  },
  connect: {
    title: "Connect Wallet",
    /** "New to Sui? Test funds are free →" */
    newHere: "New to Somnia? Test funds are free →",
  },
} as const;
