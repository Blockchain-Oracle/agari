"use client";

import type { OrderRoute } from "@agari/core/ports";
import type { Address, EventMarket, OnchainSnapshot, Quote, Side } from "@agari/core/types";
import { formatBaseUnits, oneUnit, ownTermsPriceRaw } from "@agari/core/units";
import { capQuoteToGrant, dailyHeadroomBase, simulateCaps } from "@agari/core/vault";
import { useSubmitter, useVaultHoldings } from "@agari/markets/react";
import { SESSION } from "./copy";
import { refusalText } from "./refusal";
import { useSessionKey } from "./SessionKeyProvider";

/** Where a bet is paid from: the wallet, the Trading Balance, or — the reference's Private — the desk's slot off the private balance. */
export type FundingSource = "wallet" | "vault" | "private";

export interface TicketRoute {
  route: OrderRoute;
  submitter: ReturnType<typeof useSubmitter>;
  wallet: Address | null;
  /** What the chosen source can actually put behind a bet right now. */
  availableBase: bigint | null;
  sourceLabel: string | null;
  /** Why an armed tap fell back to the chosen source, in words; null when it did not. */
  fallbackReason: string | null;
  armed: boolean;
  deployed: boolean;
  vaultAvailableBase: bigint | null;
}

interface RouteInput {
  market: EventMarket;
  side: Side | null;
  stakeBase: bigint;
  quote: Quote | null;
  onchain: OnchainSnapshot | null;
  source: FundingSource;
  walletAvailableBase: bigint | null;
  symbol: string;
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);

/**
 * AD-3's third dimension, decided per bet: the session key inside its caps, the owner's Trading
 * Balance, or the wallet. An armed tap that the caps refuse does not fail — it says why and signs
 * from the source the user chose, exactly as the enable sheet promised.
 */
export function useTicketRoute({ market, side, stakeBase, quote, onchain, source, walletAvailableBase, symbol }: RouteInput): TicketRoute {
  const { view, session } = useSessionKey();
  const userSubmitter = useSubmitter();
  const holdings = useVaultHoldings(view.owner, onchain);
  const decimals = market.decimals;
  const deployed = view.deployment !== null;

  let fallbackReason: string | null = null;
  if (view.status === "armed" && view.grant && session) {
    const grant = view.grant;
    const headroom = dailyHeadroomBase(grant, view.nowSec);
    const capBase = min(headroom, grant.caps.maxStakePerTradeBase);
    let refusal: string | null = null;
    if (quote && side) {
      const held = holdings?.ok ? (side === "up" ? holdings.value.upRaw : holdings.value.downRaw) : 0n;
      // The key's order goes in at the grant's price cap, not the cadence's cushion above the walk (markets does the same).
      const tap = capQuoteToGrant(quote, side, grant.caps.maxPriceRaw, oneUnit(decimals), oneUnit(decimals) / 1000n);
      const verdict = simulateCaps({
        grant,
        nowSec: view.nowSec,
        sidePriceRaw: ownTermsPriceRaw(tap.limitPriceRaw, side, decimals),
        quantityRaw: tap.contractsRaw,
        spendBase: tap.expectedCostBase,
        one: oneUnit(decimals),
        opensNewPosition: held === 0n,
      });
      if (!verdict.ok) refusal = refusalText(verdict.refusal, decimals, symbol);
    } else if (stakeBase > capBase) {
      refusal = `${formatBaseUnits(stakeBase, decimals)} ${symbol} is over what the key may tap right now`;
    }
    if (!refusal) {
      return {
        route: { kind: "vault-grant", grantId: grant.grantId },
        submitter: session.submitter,
        wallet: session.address,
        availableBase: capBase,
        sourceLabel: SESSION.route.fromGrant(`${formatBaseUnits(headroom, decimals)} ${symbol}`),
        fallbackReason: null,
        armed: true,
        deployed,
        vaultAvailableBase: view.vaultAvailableBase,
      };
    }
    fallbackReason = SESSION.route.fallback(refusal);
  }

  if (source === "vault" && deployed) {
    return {
      route: { kind: "vault" },
      submitter: userSubmitter,
      wallet: view.owner,
      availableBase: view.vaultAvailableBase,
      sourceLabel: SESSION.route.fromVault,
      fallbackReason,
      armed: false,
      deployed,
      vaultAvailableBase: view.vaultAvailableBase,
    };
  }
  return {
    route: { kind: "wallet" },
    submitter: userSubmitter,
    wallet: view.owner,
    availableBase: walletAvailableBase,
    sourceLabel: fallbackReason ? SESSION.route.fromWallet : null,
    fallbackReason,
    armed: false,
    deployed,
    vaultAvailableBase: view.vaultAvailableBase,
  };
}
