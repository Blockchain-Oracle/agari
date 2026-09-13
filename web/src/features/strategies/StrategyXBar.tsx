"use client";

import { ArrowUpRightIcon, Link2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { X_LINK_STATUS } from "@/features/x/copy";
import { useXStatus } from "@/features/x/useXStatus";
import { STRATEGIES } from "./copy";
import "./strategies.css";

const DISCOVER_URL = `https://x.com/search?q=${encodeURIComponent("masayume strategy copy")}&src=typed_query&f=live`;

/** Read the same durable account binding as the X setup flow, even without an OAuth cookie. */
export function StrategyXBar() {
  const link = useXStatus();
  const binding = link.status?.binding ?? null;
  const linked = binding && !link.needsLink && !link.walletMismatch;
  const available = link.status?.configured && link.status.storeConfigured;
  const manage = linked || link.walletMismatch;
  const subtitle = link.loading ? X_LINK_STATUS.checking
    : linked ? STRATEGIES.x.linked(binding.handle)
    : link.walletMismatch ? STRATEGIES.x.walletMismatch
    : available ? STRATEGIES.x.sub
    : STRATEGIES.x.unavailable;

  return (
    <div className="strat-xbar">
      <div className="flex min-w-0 items-center gap-3">
        <span className="strat-xbar-icon">
          <XIcon className="text-ink" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="strat-xbar-title text-ink">{STRATEGIES.x.title}</p>
          <p className="strat-mono-10 truncate text-ink/40" role="status">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!link.loading && (manage || available ? (
          <Link href="/claim" className="strat-xbar-btn text-ink">
            <Link2Icon aria-hidden="true" /> {manage ? STRATEGIES.x.manage : STRATEGIES.x.connect}
          </Link>
        ) : (
          <button type="button" className="strat-xbar-btn text-ink" onClick={() => void link.refresh()}>
            {STRATEGIES.x.retry}
          </button>
        ))}
        <a href={DISCOVER_URL} target="_blank" rel="noreferrer" className="strat-xbar-btn strat-xbar-btn--v">
          {STRATEGIES.x.browse} <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
