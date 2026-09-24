"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AddFunds, CreditWelcome, OPEN_FUNDS_EVENT } from "@/features/funding";
import AgariMark from "../AgariMark";
import ThemeToggle from "../ThemeToggle";
import { DesktopNavMenu } from "./DesktopNavMenu";
import { HeaderAccount } from "./HeaderAccount";
import { HeaderMoneyPill } from "./HeaderMoneyPill";
import { MobileBottomNav } from "./MobileBottomNav";
import { DESKTOP_NAV, isActiveNavItem, type NavGroup } from "./nav-items";

const COMPACT_NAV_MAX_WIDTH = 1100;

export default function Header() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<NavGroup["id"] | null>(null);
  const [showFunds, setShowFunds] = useState(false);

  useEffect(() => setOpenGroup(null), [pathname]);

  // Add money is reachable from anywhere (a ticket's top-up gate, a deep link, the fund page) by dispatching
  // this event — one entry point, no prop drilling. The reference's `yosuku:open-funds` (`Header.tsx` L145–151).
  useEffect(() => {
    const open = () => setShowFunds(true);
    window.addEventListener(OPEN_FUNDS_EVENT, open);
    return () => window.removeEventListener(OPEN_FUNDS_EVENT, open);
  }, []);

  useEffect(() => {
    const closeAtCompactWidth = () => {
      if (window.innerWidth <= COMPACT_NAV_MAX_WIDTH) setOpenGroup(null);
    };
    closeAtCompactWidth();
    window.addEventListener("resize", closeAtCompactWidth);
    return () => window.removeEventListener("resize", closeAtCompactWidth);
  }, []);

  return (
    <>
      <header className="header">
        <Link className="logo" href="/" aria-label="Agari 上がり home" data-cursor="hover">
          <span className="logo-mark"><AgariMark /></span>
          <span className="logo-copy">
            <span className="logo-name">AGARI</span>
            <span className="logo-jp" lang="ja" data-text="上がり">上がり</span>
          </span>
        </Link>

        <div className="nav">
          <nav className="nav-links" aria-label="Primary navigation">
            {DESKTOP_NAV.map((entry) => {
              if (entry.kind === "group") {
                return (
                  <DesktopNavMenu
                    key={entry.group.id}
                    group={entry.group}
                    pathname={pathname}
                    open={openGroup === entry.group.id}
                    onOpenChange={(open) => setOpenGroup(open ? entry.group.id : null)}
                  />
                );
              }

              const active = isActiveNavItem(pathname, entry.item);
              return (
                <Link
                  key={entry.item.id}
                  href={entry.item.href}
                  className={`nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  data-cursor="hover"
                >
                  {entry.item.name}
                </Link>
              );
            })}
          </nav>

          <div className="header-right">
            <ThemeToggle />
            <HeaderMoneyPill onOpen={() => setShowFunds(true)} />
            <HeaderAccount onOpenMenu={() => setOpenGroup(null)} />
          </div>
        </div>
      </header>

      <MobileBottomNav />
      <CreditWelcome />
      <AddFunds open={showFunds} onClose={() => setShowFunds(false)} />
    </>
  );
}
