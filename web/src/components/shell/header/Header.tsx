"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AddFunds, CreditWelcome, OPEN_FUNDS_EVENT } from "@/features/funding";
import MasayumeMark from "../MasayumeMark";
import ThemeToggle from "../ThemeToggle";
import { DesktopNavMenu } from "./DesktopNavMenu";
import { HeaderAccount } from "./HeaderAccount";
import { HeaderMoneyPill } from "./HeaderMoneyPill";
import { MobileBottomNav } from "./MobileBottomNav";
import { DESKTOP_NAV, isActiveNavItem, type NavGroup } from "./nav-items";

const MOBILE_MAX_WIDTH = 720;

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
    const closeAtMobileWidth = () => {
      if (window.innerWidth <= MOBILE_MAX_WIDTH) setOpenGroup(null);
    };
    closeAtMobileWidth();
    window.addEventListener("resize", closeAtMobileWidth);
    return () => window.removeEventListener("resize", closeAtMobileWidth);
  }, []);

  return (
    <>
      <header className="header">
        <Link className="logo" href="/markets" aria-label="Masayume markets" data-cursor="hover">
          <span className="logo-mark"><MasayumeMark /></span>
          <span>MASAYUME</span>
        </Link>

        <nav className="nav" aria-label="Primary navigation">
          <div className="nav-links">
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
          </div>

          <div className="header-right">
            <ThemeToggle />
            <HeaderMoneyPill onOpen={() => setShowFunds(true)} />
            <HeaderAccount onOpenMenu={() => setOpenGroup(null)} />
          </div>
        </nav>
      </header>

      <MobileBottomNav />
      <CreditWelcome />
      <AddFunds open={showFunds} onClose={() => setShowFunds(false)} />
    </>
  );
}
