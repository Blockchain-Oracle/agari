"use client";

import Link from "next/link";
import { ConnectButton } from "../wallet";
import { PLATE } from "./plate/copy";
import "./plate/ledger-plate.css";

/** The disconnected state, ported from `reference/yosuku/app/portfolio/page.tsx` L277–292: connecting a wallet is what the page is FOR. */
export function ConnectCard() {
  return (
    <div className="connect-card">
      <div className="connect-card-ring">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M22 10H2" />
        </svg>
      </div>
      <h2 className="connect-card-title">{PLATE.connect.title}</h2>
      <div className="flex flex-col items-center gap-3">
        <ConnectButton />
        <Link href="/how-it-works" className="connect-card-link">
          {PLATE.connect.newHere}
        </Link>
      </div>
    </div>
  );
}
