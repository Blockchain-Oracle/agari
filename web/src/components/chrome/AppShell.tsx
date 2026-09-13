import type { ReactNode } from "react";
import { PillNav } from "./PillNav";
import { TopHeader } from "./TopHeader";

interface AppShellProps {
  ticker?: ReactNode;
  banner?: ReactNode;
  headerActions?: ReactNode;
  claimPill?: ReactNode;
  children: ReactNode;
}

/** Ticker → banner → header (lg) → main (clears the pill nav) → pill nav (<lg) → claim pill. */
export function AppShell({ ticker, banner, headerActions, claimPill, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {ticker}
      {banner}
      <TopHeader actions={headerActions} />
      <main className="flex flex-1 flex-col pb-(--pill-nav-clearance) lg:pb-section-desktop">{children}</main>
      <PillNav />
      {claimPill}
    </div>
  );
}
