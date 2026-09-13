"use client";

import { ActivityIcon, GalleryVerticalIcon, WalletIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItem } from "./nav-items";

const ICONS: Record<NavIconKey, LucideIcon> = {
  markets: ActivityIcon,
  reels: GalleryVerticalIcon,
  portfolio: WalletIcon,
};

const LAYOUT_CLASSES = {
  pill: "min-w-touch flex-col gap-0.5 rounded-full px-4 type-label-micro",
  bar: "gap-2 rounded-md px-3 type-body-strong",
} as const;

interface NavLinkProps extends NavItem {
  layout: keyof typeof LAYOUT_CLASSES;
}

export function NavLink({ href, label, icon, layout }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-touch items-center justify-center transition-colors",
        LAYOUT_CLASSES[layout],
        active ? "bg-surface-2 text-ink" : "text-ink-secondary hover:text-ink",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
