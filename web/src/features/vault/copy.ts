import type { GrantKind } from "@masayume/core/vault";
import { VAULT_NOT_DEPLOYED } from "@masayume/core/vault";

/**
 * The Trading Balance — ported from the reference's `trading_vault` card
 * (`reference/yosuku/app/portfolio/page.tsx` at `1a36ffa^`, the last commit that mounted it)
 * and its pool-row grammar (`components/portfolio/PoolRows.tsx`: label, one sentence saying
 * what the pool is FOR and who can move it, then the amount).
 */
export const VAULT = {
  /** The pool row under the plate — the reference's X row reads "Your X replies bet from this. Only you can cash it out." */
  row: {
    label: "Trading Balance",
    note: "Bets you place from it and grants you allow spend from here. Only you can withdraw it.",
    /** null renders as a placeholder rather than a fake 0.00 (`PoolRows.tsx` L13). */
    unknown: "—",
    manage: "Manage",
  },
  /** The card block (reference L416–466). */
  eyebrow: "Trading balance",
  /** Truth-corrected: the reference said "Your new bets do not use this" because its bets ran on the manager account. Here the vault route bets from it. */
  note: "Bets placed from it and the grants you allow spend from here. Move it to your wallet whenever you want.",
  amountLabel: "Trading Balance amount",
  deposit: "Deposit",
  depositing: "Depositing",
  withdraw: "Withdraw",
  withdrawing: "Withdrawing",
  withdrawPrivate: "Withdraw Private",
  loading: "Loading your balance…",
  /** The Ticket's own sentence for an absorbed allowance (Approvals convention). */
  approvalNote: "Two signatures this first time: approve tUSDC, then the deposit.",
  /** The snapshot cells (reference L358–412), the ones the vault can fill truthfully. */
  cells: {
    wallet: "Wallet",
    available: "Available",
    inTrades: "In trades",
    inTradesNote: "at cost — the venue does not price vault positions yet",
    private: "Private",
    grants: "In grants",
    positions: "Positions",
  },
  none: "—",
  /** The grants disclosure — additive; the session manager and strategy surfaces own their own controls. */
  grants: {
    title: "Grants you allow",
    kind: { session: "Tap-trading key", executor: "X replies", strategy: "Strategy" } satisfies Record<GrantKind, string>,
    budget: "budget",
    expires: "expires",
    revoke: "Revoke",
    revoking: "Revoking",
    revokeNote: "returns the unspent budget; positions it opened stay yours",
  },
  /** The vault's own venue credit — housekeeping, permissionless, shown only when there is any. */
  sweep: {
    note: (amount: string) => `${amount} of the vault's venue credit sits on a pool; sweep it back before a withdrawal needs it.`,
    action: "Sweep",
    sweeping: "Sweeping",
  },
  notDeployed: {
    why: VAULT_NOT_DEPLOYED,
    how: "A record in contracts/deployments, or the NEXT_PUBLIC_EVENT_VAULT_ADDRESS override, connects it. Wallet orders keep working.",
  },
  positionsNote: "Positions the vault holds for you appear under Your bets.",
  /** Open bets the vault holds (`BetRow` grammar, plus the seat). */
  bets: {
    from: "from Trading Balance",
    staked: "Staked",
    unpriced: "worth-now not priced for vault positions",
    empty: "The vault holds nothing open right now.",
  },
  /** Settled vault rounds — the history row's words. */
  rounds: {
    via: "via Trading Balance",
    crank: "Settle into Trading Balance",
    cranking: "Settling…",
    cranked: "Settled into your Trading Balance.",
    crankNote: "anyone may settle it; the credit lands on your balance",
  },
  /** /claims — never summed into the wallet's claim-all. */
  claims: {
    title: "From your Trading Balance",
    credit: (amount: string) => `${amount} sits in your Trading Balance`,
    withdrawOn: "withdraw on Portfolio →",
    waiting: (n: number) => (n === 1 ? "1 settled Window to settle into it" : `${n} settled Windows to settle into it`),
  },
  toasts: {
    deposited: "Deposit landed in your Trading Balance.",
    withdrawn: "Withdrawn to your wallet.",
    movedPrivate: "Moved to your private balance.",
    withdrawnPrivate: "Private balance withdrawn to your wallet.",
    revoked: "Grant revoked; its budget is back in your balance.",
    swept: "Venue credit swept into the vault.",
    unknown: "Waiting for the chain to answer — the write is journaled, nothing is re-sent.",
  },
  devTitle: "Trading Balance",
  fixtures: {
    notDeployed: "Not deployed on this network",
    empty: "Deployed — empty balance",
    funded: "Funded — available and private",
    grants: "Funded — with live grants",
    busy: "Write in flight — deposit",
    stale: "Stale — last good kept, as-of tick",
    error: "First read failed",
    loading: "Nothing known yet",
    bets: "Open bets the vault holds",
    live: "Live — connected wallet",
  },
} as const;
