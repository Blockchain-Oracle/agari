"use client";

import type { MakerVaultState } from "@masayume/core/maker";
import { oneUnit } from "@masayume/core/units";
import { EARN } from "./copy";
import { formatSharePrice, money2, sharePriceDeltaPct, utilizationPct } from "./format";

interface VaultPanelProps {
  vault: MakerVaultState | null;
  symbol: string;
}

/**
 * The hero's live panel (`app/earn/page.tsx` L157–207): the share price as the hero number, the delta chip
 * above par, vault value, utilization with its meter. Every number is the live contract, or the panel says so.
 * The reference's decorative curve beside "Up from 1.0000" drew no data, so it is not here (doc 05 §No fake-data).
 */
export function VaultPanel({ vault, symbol }: VaultPanelProps) {
  const { panel } = EARN;
  if (!vault) {
    return (
      <div className="earn-vault ea-panel">
        <div className="earn-vault-accent" />
        <p className="ea-loading">{panel.loading}</p>
      </div>
    );
  }
  const one = oneUnit(vault.decimals);
  const delta = sharePriceDeltaPct(vault.sharePriceRaw, one);
  const below = vault.supplyShares > 0n && vault.sharePriceRaw < one;
  const status = vault.paused ? panel.paused : vault.maker === null ? panel.noMaker : panel.live;
  return (
    <div className="earn-vault ea-panel">
      <div className="earn-vault-accent" />
      <div className="ea-panel-inner">
        <div className="ea-panel-head">
          <span className="ea-tag">{status}</span>
          <span className="ea-tag ea-tag--brand">{panel.brand}</span>
        </div>

        <div className="ea-price-row">
          <div className="ea-price">
            {formatSharePrice(vault.sharePriceRaw, vault.decimals)}
            <span className="ea-price-unit">{panel.perShare}</span>
          </div>
          {delta && (
            <span className="earn-chipg ea-chip">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                <path d="M4 0 L8 7 L0 7 Z" fill="currentColor" />
              </svg>
              {delta}
            </span>
          )}
        </div>
        <div className="ea-since">{below ? panel.belowLaunch : panel.sinceLaunch}</div>

        <div className="earn-hair ea-hair" />

        <div className="ea-metrics">
          <div>
            <div className="ea-k">{panel.vaultValue}</div>
            <div className="ea-v">
              {money2(vault.totalValueBase, vault.decimals)} <span className="ea-v-unit">{symbol}</span>
            </div>
          </div>
          <div>
            <div className="ea-k">{panel.utilization}</div>
            <div className="ea-v ea-v--accent">{utilizationPct(vault.utilizationBps)}</div>
            <div className="earn-meter">
              <div className="earn-meter-fill ea-meter-fill" style={{ "--ea-fill": `${Math.min(100, vault.utilizationBps / 100)}%` } as React.CSSProperties} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
