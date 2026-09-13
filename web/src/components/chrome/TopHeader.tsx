import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/copy";
import { NavLink } from "./NavLink";
import { NAV_ITEMS } from "./nav-items";

interface TopHeaderProps {
  /** Wallet controls land here in Story 1.5. */
  actions?: ReactNode;
}

export function TopHeader({ actions }: TopHeaderProps) {
  return (
    <header className="hidden items-center justify-between gap-6 border-b border-hairline px-gutter-desktop py-2 lg:flex">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="type-title text-ink">{BRAND.name}</span>
        <span lang="ja" className="type-data text-ink-muted">
          {BRAND.kanji}
        </span>
      </Link>
      <nav aria-label="Primary">
        <ul className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink {...item} layout="bar" />
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-h-touch items-center gap-2">{actions}</div>
    </header>
  );
}
