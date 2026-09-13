"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isActiveNavItem, MOBILE_DRAWER_SECTIONS, MOBILE_NAV, MOBILE_OVERFLOW } from "./nav-items";

/** Four fast destinations plus one complete, accessible navigation drawer. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const fastPathActive = MOBILE_NAV.some((item) => isActiveNavItem(pathname, item));
  const moreActive = !fastPathActive && MOBILE_OVERFLOW.some((item) => isActiveNavItem(pathname, item));

  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {MOBILE_NAV.map((item) => {
          const active = isActiveNavItem(pathname, item);
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <SheetTrigger
          render={<button type="button" className={moreActive || open ? "active" : ""} />}
          aria-label="Open all navigation"
        >
          <MoreHorizontal aria-hidden="true" />
          <span>More</span>
        </SheetTrigger>
      </nav>

      <SheetContent side="right" className="mobile-nav-drawer" overlayClassName="mobile-nav-overlay">
        <SheetHeader className="mobile-nav-header">
          <span className="mobile-nav-kicker">Navigate</span>
          <SheetTitle>Everything in Masayume</SheetTitle>
          <SheetDescription>Build, trade, verify, or learn—every destination has one home.</SheetDescription>
        </SheetHeader>
        <nav className="mobile-nav-groups" aria-label="All Masayume destinations">
          {MOBILE_DRAWER_SECTIONS.map((section) => (
            <section className="mobile-nav-group" key={section.id} aria-labelledby={`mobile-nav-${section.id}`}>
              <div className="mobile-nav-group-title">
                <h2 id={`mobile-nav-${section.id}`}>{section.name}</h2>
                <span>{section.description}</span>
              </div>
              <div className="mobile-nav-links">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveNavItem(pathname, item);
                  const Destination = item.external ? "a" : Link;
                  return (
                    <Destination
                      key={item.id}
                      href={item.href}
                      className={`mobile-nav-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span className="mobile-nav-icon"><Icon aria-hidden="true" /></span>
                      <span className="mobile-nav-copy">
                        <strong>{item.name}{item.beta && <sup>beta</sup>}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Destination>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
