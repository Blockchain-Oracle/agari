"use client";

import type { ReserveKind } from "@agari/core/reserves";
import { EARN } from "./copy";
import { RESERVES, RESERVE_TABS } from "./reserves";

interface ReserveTabsProps {
  active: ReserveKind;
  onSelect: (kind: ReserveKind) => void;
}

/** The four reserves a wallet can supply, in the leaderboard's own tab row. */
export function ReserveTabs({ active, onSelect }: ReserveTabsProps) {
  return (
    <div className="container ea-tabs">
      <div className="asset-tabs" role="tablist" aria-label={EARN.tabsLabel}>
        {RESERVE_TABS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={kind === active}
            className={kind === active ? "asset-tab active" : "asset-tab"}
            onClick={() => onSelect(kind)}
            data-cursor="hover"
          >
            {RESERVES[kind].label}
          </button>
        ))}
      </div>
    </div>
  );
}
